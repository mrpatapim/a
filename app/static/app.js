const API_URL = "";

function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast`;
    toast.style.backgroundColor = type === "success" ? "var(--success)" : "var(--danger)";
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

function switchTab(tab) {
    if (tab === 'login') {
        document.getElementById('login-form').style.display = 'flex';
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('tab-login').classList.add('active');
        document.getElementById('tab-register').classList.remove('active');
    } else {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'flex';
        document.getElementById('tab-login').classList.remove('active');
        document.getElementById('tab-register').classList.add('active');
    }
}

function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    
    const targetView = document.getElementById(viewId);
    if (targetView) targetView.classList.add('active');
    
    const triggeredBtn = document.querySelector(`[onclick="switchView('${viewId}')"]`);
    if (triggeredBtn) triggeredBtn.classList.add('active');
}

function downloadCSV(csvContent, filename) {
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function handleRegister(e) {
    e.preventDefault();
    const msg = document.getElementById('error-msg');
    
    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: document.getElementById('reg-username').value,
                email: document.getElementById('reg-email').value,
                street: document.getElementById('reg-street').value,
                house: document.getElementById('reg-house').value,
                apartment: document.getElementById('reg-apartment').value || null,
                floor: document.getElementById('reg-floor').value || null,
                password: document.getElementById('reg-password').value
            })
        });
        
        if (!res.ok) {
            const errBody = await res.json();
            if (errBody.detail && Array.isArray(errBody.detail)) {
                throw new Error(errBody.detail[0].msg);
            }
            throw new Error("Пользователь с такими данными уже зарегистрирован");
        }
        
        const data = await res.json();
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("isAdmin", data.is_admin ? "true" : "false");
        window.location.href = "/dashboard";
        
    } catch (err) {
        msg.innerText = err.message;
        showToast(err.message, "danger");
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const msg = document.getElementById('error-msg');
    const formData = new URLSearchParams();
    formData.append('username', document.getElementById('login-username').value);
    formData.append('password', document.getElementById('login-password').value);

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });
        if (!res.ok) throw new Error("Неверное имя пользователя или пароль");
        const data = await res.json();
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("isAdmin", data.is_admin ? "true" : "false");
        window.location.href = "/dashboard";
    } catch (err) {
        msg.innerText = err.message;
        showToast(err.message, "danger");
    }
}

function logout() {
    localStorage.clear();
    window.location.href = "/";
}

async function initDashboard() {
    const isAdmin = localStorage.getItem("isAdmin") === "true";
    const roleBadge = document.getElementById("sidebar-role");
    
    const dateInput = document.getElementById("reading-date");
    if(dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    if (isAdmin) {
        if (roleBadge) roleBadge.innerText = "Администратор";
        document.getElementById("menu-user-zones").style.display = "none";
        document.getElementById("menu-admin-zones").style.display = "flex";
        switchView("view-admin");
        await loadAdminStats();
        await loadAdminRevenue();
        await loadAdminUsers();
    } else {
        if (roleBadge) roleBadge.innerText = "Личный кабинет жильца";
        document.getElementById("menu-user-zones").style.display = "flex";
        document.getElementById("menu-admin-zones").style.display = "none";
        await loadServiceTypes();
        await loadMeters();
        await loadAnalyticsAndBudget();
    }
}

async function promptBudgetUpdate() {
    const newVal = prompt("Установите желаемый лимит расходов на месяц (руб):", "5000");
    if (newVal === null || isNaN(newVal)) return;
    const budget = parseFloat(newVal);
    
    const token = localStorage.getItem("token");
    await fetch(`${API_URL}/users/me/budget`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ budget: budget })
    });
    showToast("Бюджет успешно обновлен");
    await loadAnalyticsAndBudget();
}

async function loadServiceTypes() {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/bills/service-types`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const types = await res.json();
    const select = document.getElementById('meter-service-type');
    if (select) {
        select.innerHTML = "";
        types.forEach(t => {
            select.innerHTML += `<option value="${t.id}">${t.name} (${t.unit})</option>`;
        });
    }
}

async function loadMeters() {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/bills/meters`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const meters = await res.json();
    
    const countBadge = document.getElementById("kpi-active-meters");
    if (countBadge) countBadge.innerText = meters.length;

    const select = document.getElementById('reading-meter-id');
    if (select) {
        select.innerHTML = "";
        meters.forEach(m => {
            select.innerHTML += `<option value="${m.id}">Прибор №${m.serial_number}</option>`;
        });
        loadReadingHistory();
    }

    checkSmartAlerts(meters, token);
}

async function checkSmartAlerts(meters, token) {
    const alertsZone = document.getElementById("smart-alerts-zone");
    if (!alertsZone) return;
    alertsZone.innerHTML = "";

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const m of meters) {
        const res = await fetch(`${API_URL}/bills/meters/${m.id}/readings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const readings = await res.json();
        
        let needsAlert = false;
        if (readings.length === 0) {
            needsAlert = true;
        } else {
            const lastReadingDate = new Date(readings[readings.length - 1].recorded_at);
            if (lastReadingDate < thirtyDaysAgo) {
                needsAlert = true;
            }
        }

        if (needsAlert) {
            alertsZone.innerHTML += `
                <div class="alert-banner">
                    <span>⚠️ Внимание: По счетчику №${m.serial_number} давно не передавались показания!</span>
                    <button onclick="switchView('view-meters')" style="margin:0; padding:6px 12px; background:#fff; color:var(--warning); width:auto; font-size:12px;">Передать сейчас</button>
                </div>
            `;
        }
    }
}

async function handleCreateMeter(e) {
    e.preventDefault();
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_URL}/bills/meters`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                service_type_id: parseInt(document.getElementById('meter-service-type').value),
                serial_number: document.getElementById('meter-serial').value,
                current_tariff: parseFloat(document.getElementById('meter-tariff').value)
            })
        });
        if (!res.ok) throw new Error("Прибор с таким серийным номером уже существует");
        showToast("Новый счетчик успешно добавлен в систему");
        document.getElementById('meter-serial').value = "";
        document.getElementById('meter-tariff').value = "";
        await loadMeters();
        await loadAnalyticsAndBudget();
    } catch(err) {
        showToast(err.message, "danger");
    }
}

async function handleAddReading(e) {
    e.preventDefault();
    const token = localStorage.getItem("token");
    const meterId = document.getElementById('reading-meter-id').value;
    if(!meterId) return showToast("Сначала зарегистрируйте прибор", "danger");
    
    const chosenDate = document.getElementById('reading-date').value;
    let payloadDate = null;
    if(chosenDate) payloadDate = new Date(chosenDate).toISOString();

    try {
        const res = await fetch(`${API_URL}/bills/meters/${meterId}/readings`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                reading_value: parseFloat(document.getElementById('reading-value').value),
                recorded_at: payloadDate
            })
        });
        if(!res.ok) throw new Error("Ошибка: новое значение не может быть меньше предыдущего");
        showToast("Показание прибора успешно зафиксировано");
        document.getElementById('reading-value').value = "";
        
        await loadReadingHistory();
        await loadAnalyticsAndBudget();
        loadMeters();
    } catch(err) {
        showToast(err.message, "danger");
    }
}

async function loadReadingHistory() {
    const token = localStorage.getItem("token");
    const meterId = document.getElementById('reading-meter-id').value;
    const listDiv = document.getElementById('readings-history-list');
    if (!listDiv) return;
    listDiv.innerHTML = "";
    if(!meterId) return;

    const res = await fetch(`${API_URL}/bills/meters/${meterId}/readings`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const readings = await res.json();
    readings.reverse().forEach(r => {
        const date = new Date(r.recorded_at).toLocaleDateString();
        listDiv.innerHTML += `
            <div class="list-row">
                <div>
                    <div style="font-weight:600; font-size:14px;">${r.service_name} [№${r.serial_number}]</div>
                    <div style="font-size:13px; font-weight:500; color:var(--primary); margin-top:2px;">Показание: ${r.reading_value} ${r.unit}</div>
                    <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Дата фиксации: ${date} | Начислено: ${r.calculated_cost} ₽</div>
                </div>
                <button class="btn-danger" style="padding:6px 12px; font-size:12px; width:auto; margin:0;" onclick="deleteReading(${r.id})">Удалить</button>
            </div>
        `;
    });
}

async function deleteReading(id) {
    if(!confirm("Вы уверены, что хотите удалить эту запись?")) return;
    const token = localStorage.getItem("token");
    await fetch(`${API_URL}/bills/readings/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    showToast("Запись удалена");
    await loadReadingHistory();
    await loadAnalyticsAndBudget();
    loadMeters();
}

async function exportUserCSV() {
    const token = localStorage.getItem("token");
    const resMeters = await fetch(`${API_URL}/bills/meters`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const meters = await resMeters.json();
    
    let csvStr = "Серийный номер;Услуга;Дата фиксации;Показание;Расход;Начислено (Руб)\n";
    
    for (const m of meters) {
        const res = await fetch(`${API_URL}/bills/meters/${m.id}/readings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const readings = await res.json();
        readings.forEach(r => {
            const date = new Date(r.recorded_at).toLocaleDateString();
            csvStr += `${r.serial_number};${r.service_name};${date};${r.reading_value};${r.consumed_volume};${r.calculated_cost}\n`;
        });
    }
    
    downloadCSV(csvStr, "my_bills_history.csv");
    showToast("Выписка успешно загружена");
}

let chartInstance = null;
async function loadAnalyticsAndBudget() {
    const token = localStorage.getItem("token");
    
    const userRes = await fetch(`${API_URL}/users/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const userData = await userRes.json();
    const budget = userData.monthly_budget;

    const res = await fetch(`${API_URL}/analytics/summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    
    const totalSpent = data.summary_by_service.reduce((sum, s) => sum + s.total_spent, 0);
    
    const spentBadge = document.getElementById("kpi-total-spent");
    if (spentBadge) spentBadge.innerText = `${totalSpent.toFixed(2)} ₽`;

    const bCard = document.getElementById('budget-card');
    if (bCard) {
        bCard.style.display = "block";
        document.getElementById('budget-text-spent').innerText = `Потрачено: ${totalSpent.toFixed(2)} ₽`;
        document.getElementById('budget-text-limit').innerText = `Лимит: ${budget.toFixed(2)} ₽`;
        
        const pBar = document.getElementById('budget-progress');
        if (budget > 0) {
            let percent = (totalSpent / budget) * 100;
            if (percent > 100) percent = 100;
            pBar.style.width = `${percent}%`;
            
            if (percent < 60) pBar.style.backgroundColor = "var(--success)";
            else if (percent < 90) pBar.style.backgroundColor = "var(--warning)";
            else pBar.style.backgroundColor = "var(--danger)";
        } else {
            pBar.style.width = "0%";
        }
    }

    const summaryDiv = document.getElementById('analytics-summary');
    if (!summaryDiv) return;
    summaryDiv.innerHTML = "";
    
    if(data.summary_by_service.length === 0) {
        summaryDiv.innerHTML = "<p style='color:var(--text-muted); font-size:14px;'>Нет данных для формирования аналитики.</p>";
        return;
    }

    data.summary_by_service.forEach(s => {
        summaryDiv.innerHTML += `
            <div class="list-row">
                <span style="font-weight:500;">${s.service_name}</span>
                <span style="font-weight:700; color:var(--primary);">${s.total_spent} ₽ <span style="font-size:12px; font-weight:400; color:var(--text-muted);">(${s.total_volume} ${s.unit})</span></span>
            </div>
        `;
    });

    const labels = Object.keys(data.monthly_trend);
    const values = Object.values(data.monthly_trend);
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (chartInstance) { chartInstance.destroy(); }
    
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ежемесячные начисления (₽)',
                data: values,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.08)',
                tension: 0.25,
                fill: true,
                borderWidth: 2,
                pointBackgroundColor: '#2563eb'
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: '#e2e8f0' }, ticks: { font: { family: 'Inter' } } },
                x: { grid: { display: false }, ticks: { font: { family: 'Inter' } } }
            }
        }
    });
}

async function loadForecast() {
    const token = localStorage.getItem("token");
    const resMeters = await fetch(`${API_URL}/bills/meters`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const meters = await resMeters.json();
    const resultDiv = document.getElementById('forecast-result');
    if (!resultDiv) return;
    resultDiv.innerHTML = "";

    let hasCalculations = false;

    for (const m of meters) {
        const res = await fetch(`${API_URL}/forecast/${m.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            hasCalculations = true;
            const f = await res.json();
            resultDiv.innerHTML += `
                <div class="list-row" style="border-left:4px solid var(--success); background:#ffffff;">
                    <div>
                        <div style="font-weight:600; font-size:14px;">${f.service_name} [Счетчик №${m.serial_number}]</div>
                        <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Ожидаемый объем: ${f.predicted_volume} ед.</div>
                    </div>
                    <div style="font-weight:700; color:var(--success); font-size:16px;">~ ${f.predicted_cost} ₽</div>
                </div>
            `;
        } else {
            resultDiv.innerHTML += `
                <div class="list-row" style="border-left:4px solid var(--warning); background:#ffffff;">
                    <div style="font-size:13px; color:var(--text-muted);">Счетчик №${m.serial_number}: требуется внести еще показания (минимум 3) для выстраивания тренда.</div>
                </div>
            `;
        }
    }
    if(hasCalculations) {
        showToast("Предиктивная модель успешно сформирована");
    }
}

async function loadAdminStats() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const stats = await res.json();
            const uBadge = document.getElementById('admin-total-users');
            const mBadge = document.getElementById('admin-total-meters');
            if(uBadge) uBadge.innerText = stats.total_users;
            if(mBadge) mBadge.innerText = stats.total_meters;
        }
    } catch (err) {
        console.error(err);
    }
}

let adminRevChart = null;
async function loadAdminRevenue() {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/admin/revenue`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const revData = await res.json();
    
    const labels = revData.map(r => r.service_name);
    const data = revData.map(r => r.total_revenue);
    
    const canvas = document.getElementById('revenueChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (adminRevChart) { adminRevChart.destroy(); }
    
    adminRevChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' }
            }
        }
    });
}

async function loadAdminUsers() {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const users = await res.json();
    const div = document.getElementById('admin-users-list');
    if (!div) return;
    div.innerHTML = "";
    
    if(users.length === 0) {
        div.innerHTML = "<p style='color:var(--text-muted); font-size:14px;'>В системе нет зарегистрированных жильцов.</p>";
        return;
    }

    users.forEach(u => {
        let fullAddress = u.street || "Улица не указана";
        if (u.house) fullAddress += `, д. ${u.house}`;
        if (u.apartment) fullAddress += `, кв. ${u.apartment}`;
        if (u.floor) fullAddress += `, эт. ${u.floor}`;

        div.innerHTML += `
            <div class="list-row" style="cursor:pointer;" onclick="viewUserMeters(${u.id}, '${u.username}')">
                <div style="flex: 1;">
                    <div style="font-weight:600; font-size:14px;">${u.username}</div>
                    <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">${u.email}</div>
                    <div style="font-size:11px; color:var(--primary); margin-top:2px;">${fullAddress}</div>
                </div>
                <button class="btn-danger" style="padding:6px 12px; font-size:12px; width:auto; margin:0 0 0 10px;" onclick="adminDeleteUser(event, ${u.id}, '${u.username}')">Удалить</button>
            </div>
        `;
    });
}

async function viewUserMeters(userId, username) {
    const token = localStorage.getItem("token");
    const zone = document.getElementById('admin-user-meters-zone');
    if (!zone) return;
    zone.innerHTML = `<p style="color:var(--text-muted); font-size:14px;">Обращение к серверу...</p>`;
    
    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}/meters`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const meters = await res.json();
        zone.innerHTML = `<h4 style="font-size:15px; font-weight:600; margin-bottom:10px;">Подключенные приборы жильца ${username}:</h4>`;
        
        if(meters.length === 0) {
            zone.innerHTML += `<p style="color:var(--text-muted); font-size:13px;">Данный пользователь еще не внес ни одного счетчика в систему.</p>`;
            return;
        }
        
        meters.forEach(m => {
            zone.innerHTML += `
                <div class="list-row" style="background:#ffffff;">
                    <div>
                        <div style="font-weight:600; font-size:13px;">ID системы: ${m.id} | Серийный № ${m.serial_number}</div>
                        <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Глобальный тарифный план: ${m.current_tariff} ₽ за ед.</div>
                    </div>
                </div>
            `;
        });
    } catch(err) {
        zone.innerHTML = `<p style="color:var(--danger); font-size:13px;">Сбой загрузки данных с сервера.</p>`;
    }
}

async function adminDeleteUser(event, userId, username) {
    event.stopPropagation();
    if(!confirm(`ВНИМАНИЕ!\nВы собираетесь безвозвратно удалить жильца ${username} и всю историю его приборов учета.\nПродолжить?`)) return;
    
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Ошибка при удалении пользователя");
        
        showToast(`Пользователь ${username} удален из базы`);
        document.getElementById('admin-user-meters-zone').innerHTML = '<p style="color: var(--text-muted); font-size: 14px;">Выберите учетную запись пользователя для вывода технической информации.</p>';
        await loadAdminStats();
        await loadAdminUsers();
        await loadAdminRevenue();
    } catch (err) {
        showToast(err.message, "danger");
    }
}

async function exportAdminCSV() {
    const token = localStorage.getItem("token");
    const resUsers = await fetch(`${API_URL}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const users = await resUsers.json();
    
    let csvStr = "ID Жильца;ФИО;Email;Улица;Дом;Кв;Серийный номер;Услуга;Тариф\n";
    
    for (const u of users) {
        const resMeters = await fetch(`${API_URL}/admin/users/${u.id}/meters`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const meters = await resMeters.json();
        
        if (meters.length === 0) {
            csvStr += `${u.id};${u.username};${u.email};${u.street || ''};${u.house || ''};${u.apartment || ''};НЕТ;НЕТ;0\n`;
        } else {
            meters.forEach(m => {
                csvStr += `${u.id};${u.username};${u.email};${u.street || ''};${u.house || ''};${u.apartment || ''};${m.serial_number};Услуга ID ${m.service_type_id};${m.current_tariff}\n`;
            });
        }
    }
    
    downloadCSV(csvStr, "global_system_dump.csv");
    showToast("Глобальный дамп базы успешно скачан");
}