const API_URL = "";
const YANDEX_API_KEY = "";
const BLUE_SCALE = ["#0b1f4d", "#1e40af", "#1d4ed8", "#2563eb", "#3b82f6", "#0ea5e9", "#60a5fa", "#93c5fd"];

function authHeaders(json) {
    const token = localStorage.getItem("token");
    const headers = { "Authorization": `Bearer ${token}` };
    if (json) headers["Content-Type"] = "application/json";
    return headers;
}

function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type === "success" ? "success" : "danger"}`;
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3200);
}

function escapeHtml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatMoney(value) {
    const number = Number(value) || 0;
    return number.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₽";
}

function composeAddress(user) {
    let address = user.street || "Адрес не указан";
    if (user.house) address += `, д. ${user.house}`;
    if (user.apartment) address += `, кв. ${user.apartment}`;
    if (user.floor) address += `, эт. ${user.floor}`;
    return address;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function switchTab(tab) {
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const loginTab = document.getElementById("tab-login");
    const registerTab = document.getElementById("tab-register");
    if (tab === "login") {
        loginForm.style.display = "flex";
        registerForm.style.display = "none";
        loginTab.classList.add("active");
        registerTab.classList.remove("active");
    } else {
        loginForm.style.display = "none";
        registerForm.style.display = "flex";
        loginTab.classList.remove("active");
        registerTab.classList.add("active");
    }
}

function switchView(viewId) {
    document.querySelectorAll(".view-section").forEach(view => view.classList.remove("active"));
    document.querySelectorAll(".menu-item").forEach(item => item.classList.remove("active"));
    const targetView = document.getElementById(viewId);
    if (targetView) targetView.classList.add("active");
    const triggeredBtn = document.querySelector(`[onclick="switchView('${viewId}')"]`);
    if (triggeredBtn) triggeredBtn.classList.add("active");
}

function downloadCSV(csvContent, filename) {
    const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

async function handleRegister(event) {
    event.preventDefault();
    const msg = document.getElementById("error-msg");
    msg.innerText = "";
    try {
        const response = await fetch(`${API_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: document.getElementById("reg-username").value.trim(),
                email: document.getElementById("reg-email").value.trim(),
                street: document.getElementById("reg-street").value.trim(),
                house: document.getElementById("reg-house").value.trim(),
                apartment: document.getElementById("reg-apartment").value.trim() || null,
                floor: document.getElementById("reg-floor").value.trim() || null,
                password: document.getElementById("reg-password").value
            })
        });
        if (!response.ok) {
            const errorBody = await response.json();
            if (errorBody.detail && Array.isArray(errorBody.detail)) {
                throw new Error(errorBody.detail[0].msg);
            }
            throw new Error(errorBody.detail || "Пользователь с такими данными уже зарегистрирован");
        }
        const data = await response.json();
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("isAdmin", data.is_admin ? "true" : "false");
        window.location.href = "/dashboard";
    } catch (error) {
        msg.innerText = error.message;
        showToast(error.message, "danger");
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const msg = document.getElementById("error-msg");
    msg.innerText = "";
    const formData = new URLSearchParams();
    formData.append("username", document.getElementById("login-username").value.trim());
    formData.append("password", document.getElementById("login-password").value);
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData
        });
        if (!response.ok) throw new Error("Неверное имя пользователя или пароль");
        const data = await response.json();
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("isAdmin", data.is_admin ? "true" : "false");
        window.location.href = "/dashboard";
    } catch (error) {
        msg.innerText = error.message;
        showToast(error.message, "danger");
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
    if (dateInput) {
        dateInput.value = new Date().toISOString().split("T")[0];
    }

    if (isAdmin) {
        if (roleBadge) roleBadge.innerText = "Администратор системы";
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
    const input = prompt("Установите лимит расходов на месяц (₽):", "5000");
    if (input === null) return;
    const budget = parseFloat(input);
    if (isNaN(budget) || budget < 0) {
        showToast("Введите корректное числовое значение лимита", "danger");
        return;
    }
    await fetch(`${API_URL}/users/me/budget`, {
        method: "PUT",
        headers: authHeaders(true),
        body: JSON.stringify({ budget: budget })
    });
    showToast("Лимит бюджета успешно обновлен");
    await loadAnalyticsAndBudget();
}

async function loadServiceTypes() {
    const response = await fetch(`${API_URL}/bills/service-types`, { headers: authHeaders() });
    const types = await response.json();
    const select = document.getElementById("meter-service-type");
    if (select) {
        select.innerHTML = "";
        types.forEach(type => {
            const option = document.createElement("option");
            option.value = type.id;
            option.textContent = `${type.name} (${type.unit})`;
            select.appendChild(option);
        });
    }
}

async function loadMeters() {
    const response = await fetch(`${API_URL}/bills/meters`, { headers: authHeaders() });
    const meters = await response.json();

    const countBadge = document.getElementById("kpi-active-meters");
    if (countBadge) countBadge.innerText = meters.length;

    const select = document.getElementById("reading-meter-id");
    if (select) {
        select.innerHTML = "";
        meters.forEach(meter => {
            const option = document.createElement("option");
            option.value = meter.id;
            option.textContent = `Прибор №${meter.serial_number}`;
            select.appendChild(option);
        });
        loadReadingHistory();
    }

    checkSmartAlerts(meters);
}

async function checkSmartAlerts(meters) {
    const alertsZone = document.getElementById("smart-alerts-zone");
    if (!alertsZone) return;
    alertsZone.innerHTML = "";

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const meter of meters) {
        const response = await fetch(`${API_URL}/bills/meters/${meter.id}/readings`, { headers: authHeaders() });
        const readings = await response.json();

        let needsAlert = false;
        if (readings.length === 0) {
            needsAlert = true;
        } else {
            const lastReadingDate = new Date(readings[readings.length - 1].recorded_at);
            if (lastReadingDate < thirtyDaysAgo) needsAlert = true;
        }

        if (needsAlert) {
            const banner = document.createElement("div");
            banner.className = "alert-banner";
            banner.innerHTML = `
                <span>⚠️ По счетчику №${escapeHtml(meter.serial_number)} более 30 дней не передавались показания.</span>
                <button class="btn-mini" onclick="switchView('view-meters')">Передать сейчас</button>`;
            alertsZone.appendChild(banner);
        }
    }
}

async function handleCreateMeter(event) {
    event.preventDefault();
    try {
        const response = await fetch(`${API_URL}/bills/meters`, {
            method: "POST",
            headers: authHeaders(true),
            body: JSON.stringify({
                service_type_id: parseInt(document.getElementById("meter-service-type").value, 10),
                serial_number: document.getElementById("meter-serial").value.trim(),
                current_tariff: parseFloat(document.getElementById("meter-tariff").value)
            })
        });
        if (!response.ok) throw new Error("Прибор с таким серийным номером уже существует");
        showToast("Новый счетчик добавлен в систему");
        document.getElementById("meter-serial").value = "";
        document.getElementById("meter-tariff").value = "";
        await loadMeters();
        await loadAnalyticsAndBudget();
    } catch (error) {
        showToast(error.message, "danger");
    }
}

async function handleAddReading(event) {
    event.preventDefault();
    const meterId = document.getElementById("reading-meter-id").value;
    if (!meterId) {
        showToast("Сначала зарегистрируйте прибор учета", "danger");
        return;
    }
    const chosenDate = document.getElementById("reading-date").value;
    const payloadDate = chosenDate ? new Date(chosenDate).toISOString() : null;
    try {
        const response = await fetch(`${API_URL}/bills/meters/${meterId}/readings`, {
            method: "POST",
            headers: authHeaders(true),
            body: JSON.stringify({
                reading_value: parseFloat(document.getElementById("reading-value").value),
                recorded_at: payloadDate
            })
        });
        if (!response.ok) throw new Error("Новое значение не может быть меньше предыдущего показания");
        showToast("Показание прибора зафиксировано");
        document.getElementById("reading-value").value = "";
        await loadReadingHistory();
        await loadAnalyticsAndBudget();
        await loadMeters();
    } catch (error) {
        showToast(error.message, "danger");
    }
}

async function loadReadingHistory() {
    const meterId = document.getElementById("reading-meter-id").value;
    const listDiv = document.getElementById("readings-history-list");
    if (!listDiv) return;
    listDiv.innerHTML = "";
    if (!meterId) return;

    const response = await fetch(`${API_URL}/bills/meters/${meterId}/readings`, { headers: authHeaders() });
    const readings = await response.json();

    if (readings.length === 0) {
        listDiv.innerHTML = `<p class="empty-note">По данному прибору пока нет внесенных показаний.</p>`;
        return;
    }

    readings.slice().reverse().forEach(reading => {
        const date = new Date(reading.recorded_at).toLocaleDateString("ru-RU");
        const row = document.createElement("div");
        row.className = "list-row";
        row.innerHTML = `
            <div>
                <div class="row-title">${escapeHtml(reading.service_name)} [№${escapeHtml(reading.serial_number)}]</div>
                <div class="row-accent">Показание: ${reading.reading_value} ${escapeHtml(reading.unit)}</div>
                <div class="row-meta">Дата: ${date} · Начислено: ${formatMoney(reading.calculated_cost)}</div>
            </div>
            <button class="btn-danger btn-mini" onclick="deleteReading(${reading.id})">Удалить</button>`;
        listDiv.appendChild(row);
    });
}

async function deleteReading(readingId) {
    if (!confirm("Удалить выбранную запись показания?")) return;
    await fetch(`${API_URL}/bills/readings/${readingId}`, { method: "DELETE", headers: authHeaders() });
    showToast("Запись удалена");
    await loadReadingHistory();
    await loadAnalyticsAndBudget();
    await loadMeters();
}

async function exportUserCSV() {
    const metersResponse = await fetch(`${API_URL}/bills/meters`, { headers: authHeaders() });
    const meters = await metersResponse.json();

    let csv = "Серийный номер;Услуга;Дата фиксации;Показание;Расход;Начислено (руб)\n";
    for (const meter of meters) {
        const response = await fetch(`${API_URL}/bills/meters/${meter.id}/readings`, { headers: authHeaders() });
        const readings = await response.json();
        readings.forEach(reading => {
            const date = new Date(reading.recorded_at).toLocaleDateString("ru-RU");
            csv += `${reading.serial_number};${reading.service_name};${date};${reading.reading_value};${reading.consumed_volume};${reading.calculated_cost}\n`;
        });
    }
    downloadCSV(csv, "my_bills_history.csv");
    showToast("Личная выписка выгружена в CSV");
}

let trendChart = null;
async function loadAnalyticsAndBudget() {
    const userResponse = await fetch(`${API_URL}/users/me`, { headers: authHeaders() });
    const userData = await userResponse.json();
    const budget = Number(userData.monthly_budget) || 0;

    const response = await fetch(`${API_URL}/analytics/summary`, { headers: authHeaders() });
    const data = await response.json();

    const totalSpent = data.summary_by_service.reduce((sum, service) => sum + service.total_spent, 0);
    const spentBadge = document.getElementById("kpi-total-spent");
    if (spentBadge) spentBadge.innerText = formatMoney(totalSpent);

    const trend = data.monthly_trend || {};
    const monthKeys = Object.keys(trend).sort();
    const currentMonthSpent = monthKeys.length ? trend[monthKeys[monthKeys.length - 1]] : 0;

    renderBudget(currentMonthSpent, budget);
    renderServiceSummary(data.summary_by_service);
    renderTrendChart(monthKeys, monthKeys.map(key => trend[key]));
}

function renderBudget(spent, budget) {
    const card = document.getElementById("budget-card");
    if (!card) return;
    card.style.display = "block";

    document.getElementById("budget-text-spent").innerText = `Начислено за месяц: ${formatMoney(spent)}`;
    document.getElementById("budget-text-limit").innerText = budget > 0 ? `Лимит: ${formatMoney(budget)}` : "Лимит не задан";

    const bar = document.getElementById("budget-progress");
    const pill = document.getElementById("budget-status");
    const percent = budget > 0 ? (spent / budget) * 100 : 0;
    bar.style.width = `${clamp(percent, 0, 100)}%`;

    let color = "var(--text-soft)";
    let label = "Лимит не установлен";
    if (budget > 0) {
        if (percent < 70) {
            color = "var(--success)";
            label = `${Math.round(percent)}% · В пределах лимита`;
        } else if (percent < 100) {
            color = "var(--warning)";
            label = `${Math.round(percent)}% · Приближение к лимиту`;
        } else {
            color = "var(--danger)";
            label = `${Math.round(percent)}% · Лимит превышен`;
        }
    }
    bar.style.background = color;
    pill.style.color = color;
    pill.innerText = label;
}

function renderServiceSummary(summary) {
    const summaryDiv = document.getElementById("analytics-summary");
    if (!summaryDiv) return;
    summaryDiv.innerHTML = "";
    if (!summary || summary.length === 0) {
        summaryDiv.innerHTML = `<p class="empty-note">Нет данных для формирования аналитики.</p>`;
        return;
    }
    summary.forEach(service => {
        const row = document.createElement("div");
        row.className = "list-row";
        row.innerHTML = `
            <span class="row-title">${escapeHtml(service.service_name)}</span>
            <span class="row-value">${formatMoney(service.total_spent)}
                <span class="row-meta" style="display:inline; margin:0;">(${service.total_volume} ${escapeHtml(service.unit)})</span>
            </span>`;
        summaryDiv.appendChild(row);
    });
}

function renderTrendChart(labels, values) {
    const canvas = document.getElementById("trendChart");
    if (!canvas || typeof Chart === "undefined") return;
    const ctx = canvas.getContext("2d");
    if (trendChart) trendChart.destroy();

    const gradient = ctx.createLinearGradient(0, 0, 0, 260);
    gradient.addColorStop(0, "rgba(37, 99, 235, 0.28)");
    gradient.addColorStop(1, "rgba(37, 99, 235, 0.02)");

    trendChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Начисления (₽)",
                data: values,
                borderColor: "#1d4ed8",
                backgroundColor: gradient,
                tension: 0.3,
                fill: true,
                borderWidth: 2.5,
                pointBackgroundColor: "#1d4ed8",
                pointBorderColor: "#ffffff",
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: "#e6edf9" }, ticks: { color: "#5d6b88" } },
                x: { grid: { display: false }, ticks: { color: "#5d6b88" } }
            }
        }
    });
}

async function loadForecast() {
    const metersResponse = await fetch(`${API_URL}/bills/meters`, { headers: authHeaders() });
    const meters = await metersResponse.json();
    const resultDiv = document.getElementById("forecast-result");
    if (!resultDiv) return;
    resultDiv.innerHTML = "";

    if (meters.length === 0) {
        resultDiv.innerHTML = `<p class="empty-note">Сначала зарегистрируйте приборы учета и внесите показания.</p>`;
        return;
    }

    let hasCalculations = false;
    for (const meter of meters) {
        const response = await fetch(`${API_URL}/forecast/${meter.id}`, { headers: authHeaders() });
        const row = document.createElement("div");
        if (response.ok) {
            hasCalculations = true;
            const forecast = await response.json();
            row.className = "list-row";
            row.style.borderLeft = "4px solid var(--primary)";
            row.innerHTML = `
                <div>
                    <div class="row-title">${escapeHtml(forecast.service_name)} [№${escapeHtml(meter.serial_number)}]</div>
                    <div class="row-meta">Прогноз объема: ${forecast.predicted_volume} ед. · ${escapeHtml(forecast.confidence)}</div>
                </div>
                <div class="row-value">~ ${formatMoney(forecast.predicted_cost)}</div>`;
        } else {
            row.className = "list-row";
            row.style.borderLeft = "4px solid var(--warning)";
            row.innerHTML = `<div class="row-meta">Счетчик №${escapeHtml(meter.serial_number)}: требуется минимум 3 показания для построения тренда.</div>`;
        }
        resultDiv.appendChild(row);
    }
    if (hasCalculations) showToast("Предиктивная модель сформирована");
}

async function loadAdminStats() {
    try {
        const response = await fetch(`${API_URL}/admin/stats`, { headers: authHeaders() });
        if (!response.ok) return;
        const stats = await response.json();
        setText("admin-total-users", stats.total_users);
        setText("admin-total-meters", stats.total_meters);
        setText("admin-total-readings", stats.total_readings);
        setText("admin-total-revenue", formatMoney(stats.total_revenue));
    } catch (error) {
        showToast("Не удалось загрузить статистику", "danger");
    }
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.innerText = value;
}

let revenueChart = null;
async function loadAdminRevenue() {
    const response = await fetch(`${API_URL}/admin/revenue`, { headers: authHeaders() });
    const revenueData = await response.json();

    const canvas = document.getElementById("revenueChart");
    if (!canvas || typeof Chart === "undefined") return;
    const ctx = canvas.getContext("2d");
    if (revenueChart) revenueChart.destroy();

    revenueChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: revenueData.map(item => item.service_name),
            datasets: [{
                data: revenueData.map(item => item.total_revenue),
                backgroundColor: revenueData.map((item, index) => BLUE_SCALE[index % BLUE_SCALE.length]),
                borderColor: "#ffffff",
                borderWidth: 3,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "62%",
            plugins: {
                legend: {
                    position: "right",
                    labels: { color: "#0f1f3d", font: { size: 13 }, padding: 14, usePointStyle: true }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const total = context.dataset.data.reduce((sum, value) => sum + value, 0);
                            const share = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : "0.0";
                            return ` ${context.label}: ${formatMoney(context.parsed)} (${share}%)`;
                        }
                    }
                }
            }
        }
    });
}

let adminUsersCache = [];
function findCachedUser(userId) {
    return adminUsersCache.find(user => user.id === userId);
}

async function loadAdminUsers() {
    const response = await fetch(`${API_URL}/admin/users`, { headers: authHeaders() });
    const users = await response.json();
    adminUsersCache = users;

    const listDiv = document.getElementById("admin-users-list");
    if (listDiv) {
        listDiv.innerHTML = "";
        if (users.length === 0) {
            listDiv.innerHTML = `<p class="empty-note">В системе нет зарегистрированных жильцов.</p>`;
        } else {
            users.forEach(user => {
                const row = document.createElement("div");
                row.className = "list-row is-clickable";
                row.setAttribute("onclick", `viewUserMeters(${user.id})`);
                row.innerHTML = `
                    <div style="flex:1; min-width:0;">
                        <div class="row-title">${escapeHtml(user.username)}</div>
                        <div class="row-meta">${escapeHtml(user.email)}</div>
                        <div class="row-accent">${escapeHtml(composeAddress(user))}</div>
                    </div>
                    <button class="btn-danger btn-mini" onclick="adminDeleteUser(event, ${user.id})">Удалить</button>`;
                listDiv.appendChild(row);
            });
        }
    }

    initSamaraMap(users);
}

async function viewUserMeters(userId) {
    const user = findCachedUser(userId);
    const zone = document.getElementById("admin-user-meters-zone");
    if (!zone) return;
    zone.innerHTML = `<p class="empty-note">Загрузка данных счетчиков...</p>`;
    try {
        const response = await fetch(`${API_URL}/admin/users/${userId}/meters`, { headers: authHeaders() });
        const meters = await response.json();
        const title = user ? escapeHtml(user.username) : `ID ${userId}`;
        zone.innerHTML = `<div class="row-title" style="margin-bottom:12px;">Приборы жильца: ${title}</div>`;

        if (meters.length === 0) {
            zone.innerHTML += `<p class="empty-note">Пользователь еще не внес ни одного прибора учета.</p>`;
            return;
        }
        meters.forEach(meter => {
            const lastDate = meter.last_reading ? new Date(meter.last_reading).toLocaleDateString("ru-RU") : "нет данных";
            const row = document.createElement("div");
            row.className = "list-row";
            row.innerHTML = `
                <div>
                    <div class="row-title">${escapeHtml(meter.service_name)} · №${escapeHtml(meter.serial_number)}</div>
                    <div class="row-meta">Тариф: ${meter.current_tariff} ₽/${escapeHtml(meter.unit)} · Показаний: ${meter.readings_count} · Последнее: ${lastDate}</div>
                </div>
                <div class="row-value">${formatMoney(meter.total_cost)}</div>`;
            zone.appendChild(row);
        });
    } catch (error) {
        zone.innerHTML = `<p class="empty-note" style="color:var(--danger);">Сбой загрузки данных с сервера.</p>`;
    }
}

async function adminDeleteUser(event, userId) {
    event.stopPropagation();
    const user = findCachedUser(userId);
    const name = user ? user.username : `ID ${userId}`;
    if (!confirm(`Удалить жильца ${name} и всю историю его приборов учета без возможности восстановления?`)) return;
    try {
        const response = await fetch(`${API_URL}/admin/users/${userId}`, { method: "DELETE", headers: authHeaders() });
        if (!response.ok) throw new Error("Ошибка при удалении пользователя");
        showToast(`Жилец ${name} удален из базы`);
        document.getElementById("admin-user-meters-zone").innerHTML = `<p class="empty-note">Выберите учетную запись пользователя для вывода технической информации.</p>`;
        await loadAdminStats();
        await loadAdminRevenue();
        await loadAdminUsers();
    } catch (error) {
        showToast(error.message, "danger");
    }
}

async function exportAdminCSV() {
    const response = await fetch(`${API_URL}/admin/users`, { headers: authHeaders() });
    const users = await response.json();

    let csv = "ID;ФИО;Email;Улица;Дом;Кв;Этаж;Лимит/мес;Серийный номер;Услуга;Тариф;Показаний;Начислено\n";
    for (const user of users) {
        const metersResponse = await fetch(`${API_URL}/admin/users/${user.id}/meters`, { headers: authHeaders() });
        const meters = await metersResponse.json();
        const base = `${user.id};${user.username};${user.email};${user.street || ""};${user.house || ""};${user.apartment || ""};${user.floor || ""};${user.monthly_budget}`;
        if (meters.length === 0) {
            csv += `${base};—;—;0;0;0\n`;
        } else {
            meters.forEach(meter => {
                csv += `${base};${meter.serial_number};${meter.service_name};${meter.current_tariff};${meter.readings_count};${meter.total_cost}\n`;
            });
        }
    }
    downloadCSV(csv, "global_system_dump.csv");
    showToast("Глобальный дамп базы выгружен в CSV");
}

const SAMARA_CENTER = [53.1981, 50.1136];

const SAMARA_STREETS_LL = {
    "ул. Куйбышева": [53.1882, 50.0972],
    "ул. Галактионовская": [53.1929, 50.1003],
    "ул. Самарская": [53.1962, 50.1041],
    "ул. Молодогвардейская": [53.1995, 50.1079],
    "ул. Чапаевская": [53.1944, 50.1016],
    "ул. Фрунзе": [53.1916, 50.0985],
    "ул. Ленинградская": [53.1908, 50.0996],
    "ул. Некрасовская": [53.1897, 50.1002],
    "ул. Венцека": [53.1872, 50.0958],
    "ул. Степана Разина": [53.1858, 50.0989],
    "ул. Полевая": [53.2010, 50.1300],
    "ул. Осипенко": [53.2090, 50.1500],
    "ул. Мичурина": [53.2050, 50.1430],
    "ул. Первомайская": [53.2105, 50.1545],
    "проспект Ленина": [53.2120, 50.1560],
    "ул. Революционная": [53.2155, 50.1690],
    "ул. Ново-Садовая": [53.2169, 50.1665],
    "Московское шоссе": [53.2275, 50.1900],
    "ул. Авроры": [53.2230, 50.1700],
    "ул. Партизанская": [53.2205, 50.1845],
    "ул. Аэродромная": [53.2200, 50.1760],
    "ул. Карла Маркса": [53.2200, 50.2000],
    "ул. XXII Партсъезда": [53.2330, 50.2100],
    "ул. Ново-Вокзальная": [53.2300, 50.1980],
    "ул. Советской Армии": [53.2360, 50.2080],
    "ул. Гагарина": [53.2280, 50.2050],
    "ул. Победы": [53.2380, 50.2200],
    "ул. Стара-Загора": [53.2470, 50.2300],
    "ул. Ташкентская": [53.2540, 50.2520],
    "ул. Демократическая": [53.2560, 50.2200],
    "проспект Кирова": [53.2420, 50.2360]
};

const SAMARA_LL_INDEX = {};

(function buildSamaraLatLngIndex() {
    for (const name in SAMARA_STREETS_LL) {
        const normalized = normalizeStreet(name);
        SAMARA_LL_INDEX[normalized] = SAMARA_STREETS_LL[name];
        SAMARA_LL_INDEX[stripStreetPrefix(normalized)] = SAMARA_STREETS_LL[name];
    }
})();

let yandexMapInstance = null;
let samaraUsersCache = [];

function loadYandexMaps(timeoutMs) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (callback, argument) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            callback(argument);
        };
        const timer = setTimeout(() => finish(reject, new Error("timeout")), timeoutMs);
        const ready = () => {
            if (window.ymaps && window.ymaps.Map) {
                window.ymaps.ready(() => finish(resolve, window.ymaps));
            } else {
                finish(reject, new Error("ymaps unavailable"));
            }
        };
        if (window.ymaps && window.ymaps.Map) {
            ready();
            return;
        }
        let script = document.getElementById("yandex-maps-sdk");
        if (!script) {
            script = document.createElement("script");
            script.id = "yandex-maps-sdk";
            script.src = "https://api-maps.yandex.ru/2.1/?lang=ru_RU" + (YANDEX_API_KEY ? "&apikey=" + encodeURIComponent(YANDEX_API_KEY) : "");
            script.async = true;
            document.head.appendChild(script);
        }
        script.addEventListener("load", ready);
        script.addEventListener("error", () => finish(reject, new Error("script error")));
    });
}

function latlngForUser(user) {
    const normalized = normalizeStreet(user.street);
    return SAMARA_LL_INDEX[normalized] || SAMARA_LL_INDEX[stripStreetPrefix(normalized)] || null;
}

function offsetCenter(user) {
    const hash = hashString((user.street || "") + "|" + (user.username || ""));
    const deltaLat = ((hash % 220) - 110) / 10000;
    const deltaLng = (((hash >> 5) % 220) - 110) / 10000;
    return [SAMARA_CENTER[0] + deltaLat, SAMARA_CENTER[1] + deltaLng];
}

function renderYandexMap(ymaps, users) {
    const container = document.getElementById("yandexMap");
    const canvas = document.getElementById("samaraMap");
    const viewport = document.getElementById("map-viewport");
    if (!container) return;
    if (canvas) canvas.style.display = "none";
    if (viewport) viewport.classList.add("is-yandex");
    container.style.display = "block";
    closeBalloon();

    if (yandexMapInstance) {
        try { yandexMapInstance.destroy(); } catch (error) { void error; }
        yandexMapInstance = null;
    }

    yandexMapInstance = new ymaps.Map(container, {
        center: SAMARA_CENTER,
        zoom: 12,
        controls: ["zoomControl", "typeSelector", "fullscreenControl"]
    }, { suppressMapOpenBlock: true });

    (users || []).forEach(user => {
        const direct = latlngForUser(user);
        if (direct) {
            addYandexPlacemark(ymaps, user, direct);
        } else {
            ymaps.geocode("Самара, " + composeAddress(user), { results: 1 })
                .then(result => {
                    const found = result.geoObjects.get(0);
                    addYandexPlacemark(ymaps, user, found ? found.geometry.getCoordinates() : offsetCenter(user));
                })
                .catch(() => addYandexPlacemark(ymaps, user, offsetCenter(user)));
        }
    });

    setTimeout(() => {
        if (!yandexMapInstance) return;
        try {
            const bounds = yandexMapInstance.geoObjects.getBounds();
            if (bounds) yandexMapInstance.setBounds(bounds, { checkZoomRange: true, zoomMargin: 45 });
        } catch (error) {
            void error;
        }
    }, 1000);
}

function addYandexPlacemark(ymaps, user, coords) {
    if (!yandexMapInstance) return;
    const budgetText = Number(user.monthly_budget) > 0 ? formatMoney(user.monthly_budget) : "не задан";
    const body = '<div style="font-size:13px;line-height:1.7;">'
        + "<b>Адрес:</b> " + escapeHtml(composeAddress(user)) + "<br>"
        + "<b>Email:</b> " + escapeHtml(user.email || "—") + "<br>"
        + "<b>Лимит/мес:</b> " + budgetText + "</div>";
    const placemark = new ymaps.Placemark(coords, {
        balloonContentHeader: escapeHtml(user.username),
        balloonContentBody: body,
        hintContent: escapeHtml(user.username)
    }, {
        preset: "islands#blueDotIcon",
        iconColor: "#1d4ed8"
    });
    yandexMapInstance.geoObjects.add(placemark);
}

function setCanvasChrome(visible) {
    ["map-hint", "map-controls-canvas", "map-legend"].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = visible ? "" : "none";
    });
}

function setMapSource(source) {
    const status = document.getElementById("map-source");
    if (source === "yandex") {
        setCanvasChrome(false);
        if (status) {
            status.textContent = "Источник: Яндекс.Карты";
            status.className = "map-source is-online";
        }
    } else {
        setCanvasChrome(true);
        if (status) {
            status.textContent = "Оффлайн-резерв (нет интернета)";
            status.className = "map-source is-offline";
        }
    }
}

async function initSamaraMap(users) {
    samaraUsersCache = users || [];
    renderCanvasMap(samaraUsersCache);
    const status = document.getElementById("map-source");
    if (status) {
        status.textContent = "Подключение к Яндекс.Картам...";
        status.className = "map-source";
    }
    try {
        const ymaps = await loadYandexMaps(12000);
        renderYandexMap(ymaps, samaraUsersCache);
        setMapSource("yandex");
    } catch (error) {
        setMapSource("offline");
    }
}

const MAP_W = 1640;
const MAP_H = 1120;

const STREET_COORDS = {
    "ул. Куйбышева": [300, 880],
    "ул. Галактионовская": [360, 840],
    "ул. Самарская": [420, 800],
    "ул. Молодогвардейская": [470, 768],
    "ул. Чапаевская": [330, 852],
    "ул. Фрунзе": [268, 902],
    "ул. Ленинградская": [382, 818],
    "ул. Венцека": [250, 924],
    "ул. Некрасовская": [312, 872],
    "ул. Водников": [228, 952],
    "ул. Степана Разина": [300, 910],
    "ул. Алексея Толстого": [262, 932],
    "ул. Полевая": [560, 660],
    "ул. Осипенко": [622, 620],
    "ул. Первомайская": [682, 598],
    "ул. Челюскинцев": [702, 642],
    "проспект Ленина": [742, 560],
    "ул. Мичурина": [640, 690],
    "ул. Революционная": [782, 662],
    "ул. Ново-Садовая": [820, 500],
    "Московское шоссе": [882, 560],
    "ул. Авроры": [862, 762],
    "ул. Партизанская": [800, 820],
    "ул. Аэродромная": [820, 720],
    "ул. Карла Маркса": [980, 560],
    "ул. XXII Партсъезда": [1042, 520],
    "ул. Ново-Вокзальная": [1000, 480],
    "ул. Советской Армии": [1082, 560],
    "ул. Гагарина": [1082, 680],
    "ул. Победы": [1142, 620],
    "ул. Стара-Загора": [1222, 500],
    "ул. Ташкентская": [1322, 460],
    "ул. Демократическая": [1242, 344],
    "ул. Дыбенко": [1162, 700],
    "ул. Антонова-Овсеенко": [1122, 742],
    "проспект Кирова": [1200, 600]
};

const MAP_AVENUES = [
    { name: "Московское шоссе", pts: [[470, 650], [700, 590], [900, 560], [1140, 592], [1320, 600]] },
    { name: "ул. Ново-Садовая", pts: [[520, 560], [760, 505], [1000, 478], [1200, 470]] },
    { name: "проспект Ленина", pts: [[560, 602], [720, 562], [900, 542]] },
    { name: "ул. Стара-Загора", pts: [[1000, 520], [1200, 500], [1360, 470]] },
    { name: "Волжский проспект", pts: [[250, 946], [520, 824], [820, 722], [1090, 640]] },
    { name: "ул. Гагарина", pts: [[860, 768], [1020, 700], [1180, 660]] }
];

const MAP_DISTRICTS = [
    { name: "Самарский р-н", x: 330, y: 752 },
    { name: "Ленинский р-н", x: 560, y: 560 },
    { name: "Октябрьский р-н", x: 860, y: 430 },
    { name: "Промышленный р-н", x: 1080, y: 412 },
    { name: "Советский р-н", x: 1180, y: 720 },
    { name: "Кировский р-н", x: 1360, y: 372 }
];

const STREET_INDEX = {};

function normalizeStreet(value) {
    return String(value || "").toLowerCase().replace(/\./g, "").replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

function stripStreetPrefix(value) {
    return value.replace(/^(улица|ул|проспект|пр-кт|пр|переулок|пер|бульвар|б-р|шоссе|ш|проезд)\s+/, "").trim();
}

(function buildStreetIndex() {
    for (const name in STREET_COORDS) {
        const normalized = normalizeStreet(name);
        STREET_INDEX[normalized] = STREET_COORDS[name];
        STREET_INDEX[stripStreetPrefix(normalized)] = STREET_COORDS[name];
    }
})();

function lookupStreet(street) {
    const normalized = normalizeStreet(street);
    return STREET_INDEX[normalized] || STREET_INDEX[stripStreetPrefix(normalized)] || null;
}

function hashString(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = (hash * 16777619) >>> 0;
    }
    return hash >>> 0;
}

function geocodeUser(user) {
    const base = lookupStreet(user.street);
    const hash = hashString((user.street || "") + "|" + (user.username || ""));
    let x;
    let y;
    if (base) {
        x = base[0];
        y = base[1];
    } else {
        x = 440 + (hash % 720);
        y = 380 + ((hash >> 4) % 410);
    }
    const house = parseInt(String(user.house || "").replace(/\D/g, ""), 10) || 0;
    const apartment = parseInt(String(user.apartment || "").replace(/\D/g, ""), 10) || 0;
    const offsetX = (((house * 37 + apartment * 13) % 64) - 32);
    const offsetY = (((house * 23 + apartment * 7 + hash) % 64) - 32);
    return { x: x + offsetX, y: y + offsetY };
}

const mapState = {
    canvas: null,
    ctx: null,
    viewport: null,
    dpr: 1,
    width: 0,
    height: 0,
    scale: 1,
    minScale: 0.3,
    maxScale: 3,
    offsetX: 0,
    offsetY: 0,
    fitScale: 1,
    fitOffsetX: 0,
    fitOffsetY: 0,
    markers: [],
    hovered: null,
    selected: null,
    initialized: false,
    rafHandle: 0,
    drag: { active: false, moved: false, startX: 0, startY: 0, baseX: 0, baseY: 0, candidate: null }
};

function renderCanvasMap(users) {
    const canvas = document.getElementById("samaraMap");
    const viewport = document.getElementById("map-viewport");
    const yandexContainer = document.getElementById("yandexMap");
    if (!canvas || !viewport) return;
    if (yandexContainer) yandexContainer.style.display = "none";
    viewport.classList.remove("is-yandex");
    canvas.style.display = "block";

    mapState.canvas = canvas;
    mapState.ctx = canvas.getContext("2d");
    mapState.viewport = viewport;
    mapState.markers = (users || []).map(user => {
        const point = geocodeUser(user);
        return { user: user, x: point.x, y: point.y };
    });
    mapState.hovered = null;
    mapState.selected = null;
    closeBalloon();

    resizeMap();
    mapState.scale = mapState.fitScale;
    mapState.offsetX = mapState.fitOffsetX;
    mapState.offsetY = mapState.fitOffsetY;

    if (!mapState.initialized) {
        canvas.addEventListener("pointerdown", onMapPointerDown);
        canvas.addEventListener("pointermove", onMapPointerMove);
        window.addEventListener("pointerup", onMapPointerUp);
        canvas.addEventListener("pointerleave", () => {
            if (!mapState.drag.active && mapState.hovered) {
                mapState.hovered = null;
                requestMapDraw();
            }
        });
        viewport.addEventListener("wheel", onMapWheel, { passive: false });
        window.addEventListener("resize", () => {
            if (mapState.initialized && mapState.viewport && mapState.viewport.clientWidth > 0) {
                resizeMap();
                mapState.scale = clamp(mapState.scale, mapState.minScale, mapState.maxScale);
                requestMapDraw();
            }
        });
        mapState.initialized = true;
    }
    requestMapDraw();
}

function resizeMap() {
    const viewport = mapState.viewport;
    const cssWidth = viewport.clientWidth;
    const cssHeight = viewport.clientHeight;
    mapState.dpr = window.devicePixelRatio || 1;
    mapState.width = cssWidth;
    mapState.height = cssHeight;
    mapState.canvas.width = Math.round(cssWidth * mapState.dpr);
    mapState.canvas.height = Math.round(cssHeight * mapState.dpr);
    const fit = Math.min(cssWidth / MAP_W, cssHeight / MAP_H) * 0.98;
    mapState.fitScale = fit;
    mapState.fitOffsetX = (cssWidth - MAP_W * fit) / 2;
    mapState.fitOffsetY = (cssHeight - MAP_H * fit) / 2;
    mapState.minScale = Math.max(0.18, fit * 0.7);
    mapState.maxScale = fit * 6;
}

function worldToScreen(worldX, worldY) {
    return { x: worldX * mapState.scale + mapState.offsetX, y: worldY * mapState.scale + mapState.offsetY };
}

function getMapPointer(event) {
    const rect = mapState.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function markerAtScreen(screenX, screenY) {
    const threshold = 17;
    let best = null;
    let bestDistance = threshold * threshold;
    for (const marker of mapState.markers) {
        const screen = worldToScreen(marker.x, marker.y);
        const dx = screen.x - screenX;
        const dy = screen.y - screenY;
        const distance = dx * dx + dy * dy;
        if (distance <= bestDistance) {
            bestDistance = distance;
            best = marker;
        }
    }
    return best;
}

function requestMapDraw() {
    if (mapState.rafHandle) return;
    mapState.rafHandle = requestAnimationFrame(() => {
        mapState.rafHandle = 0;
        drawMap();
    });
}

function onMapPointerDown(event) {
    const pointer = getMapPointer(event);
    if (mapState.canvas.setPointerCapture) {
        try { mapState.canvas.setPointerCapture(event.pointerId); } catch (error) { void error; }
    }
    mapState.drag.active = true;
    mapState.drag.moved = false;
    mapState.drag.startX = pointer.x;
    mapState.drag.startY = pointer.y;
    mapState.drag.baseX = mapState.offsetX;
    mapState.drag.baseY = mapState.offsetY;
    mapState.drag.candidate = markerAtScreen(pointer.x, pointer.y);
    mapState.viewport.classList.add("is-grabbing");
}

function onMapPointerMove(event) {
    const pointer = getMapPointer(event);
    if (mapState.drag.active) {
        const dx = pointer.x - mapState.drag.startX;
        const dy = pointer.y - mapState.drag.startY;
        if (Math.abs(dx) + Math.abs(dy) > 4) mapState.drag.moved = true;
        mapState.offsetX = mapState.drag.baseX + dx;
        mapState.offsetY = mapState.drag.baseY + dy;
        requestMapDraw();
    } else {
        const hit = markerAtScreen(pointer.x, pointer.y);
        if (hit !== mapState.hovered) {
            mapState.hovered = hit;
            mapState.canvas.style.cursor = hit ? "pointer" : "";
            requestMapDraw();
        }
    }
}

function onMapPointerUp() {
    if (mapState.drag.active && !mapState.drag.moved) {
        if (mapState.drag.candidate) {
            selectMarker(mapState.drag.candidate);
        } else if (mapState.selected) {
            closeBalloon();
        }
    }
    mapState.drag.active = false;
    mapState.drag.candidate = null;
    if (mapState.viewport) mapState.viewport.classList.remove("is-grabbing");
}

function onMapWheel(event) {
    event.preventDefault();
    const pointer = getMapPointer(event);
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    zoomMapAt(pointer.x, pointer.y, factor);
}

function zoomMapAt(screenX, screenY, factor) {
    const newScale = clamp(mapState.scale * factor, mapState.minScale, mapState.maxScale);
    const ratio = newScale / mapState.scale;
    mapState.offsetX = screenX - ratio * (screenX - mapState.offsetX);
    mapState.offsetY = screenY - ratio * (screenY - mapState.offsetY);
    mapState.scale = newScale;
    requestMapDraw();
}

function mapZoom(direction) {
    if (!mapState.initialized) return;
    const factor = direction > 0 ? 1.25 : 1 / 1.25;
    zoomMapAt(mapState.width / 2, mapState.height / 2, factor);
}

function mapResetView() {
    if (!mapState.initialized) return;
    mapState.scale = mapState.fitScale;
    mapState.offsetX = mapState.fitOffsetX;
    mapState.offsetY = mapState.fitOffsetY;
    requestMapDraw();
}

function selectMarker(marker) {
    mapState.selected = marker;
    const balloon = document.getElementById("map-balloon");
    if (!balloon) return;
    const user = marker.user;
    const initial = (user.username || "?").trim().charAt(0).toUpperCase();
    const budgetText = Number(user.monthly_budget) > 0 ? formatMoney(user.monthly_budget) : "не задан";
    balloon.innerHTML = `
        <div class="balloon-head">
            <div class="balloon-name"><span class="balloon-avatar">${escapeHtml(initial)}</span>${escapeHtml(user.username)}</div>
            <button class="balloon-close" onclick="closeBalloon()">×</button>
        </div>
        <div class="balloon-row"><b>Адрес:</b><span>${escapeHtml(composeAddress(user))}</span></div>
        <div class="balloon-row"><b>Email:</b><span>${escapeHtml(user.email || "—")}</span></div>
        <div class="balloon-row"><b>Лимит/мес:</b><span>${budgetText}</span></div>`;
    balloon.style.display = "block";
    requestMapDraw();
}

function closeBalloon() {
    mapState.selected = null;
    const balloon = document.getElementById("map-balloon");
    if (balloon) balloon.style.display = "none";
    requestMapDraw();
}

function positionBalloon() {
    const balloon = document.getElementById("map-balloon");
    if (!balloon || !mapState.selected) return;
    const screen = worldToScreen(mapState.selected.x, mapState.selected.y);
    const visible = screen.x > -40 && screen.x < mapState.width + 40 && screen.y > -40 && screen.y < mapState.height + 60;
    balloon.style.display = visible ? "block" : "none";
    balloon.style.left = `${screen.x}px`;
    balloon.style.top = `${screen.y - 14}px`;
}

function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
}

function drawMap() {
    const ctx = mapState.ctx;
    if (!ctx) return;

    ctx.setTransform(mapState.dpr, 0, 0, mapState.dpr, 0, 0);
    ctx.clearRect(0, 0, mapState.width, mapState.height);

    const landGradient = ctx.createLinearGradient(0, 0, 0, mapState.height);
    landGradient.addColorStop(0, "#e9f1fe");
    landGradient.addColorStop(1, "#dce8fb");
    ctx.fillStyle = landGradient;
    ctx.fillRect(0, 0, mapState.width, mapState.height);

    ctx.save();
    ctx.translate(mapState.offsetX, mapState.offsetY);
    ctx.scale(mapState.scale, mapState.scale);
    const inv = 1 / mapState.scale;

    drawMapGrid(ctx, inv);
    drawMapRiver(ctx, inv);
    drawMapAvenues(ctx, inv);
    drawMapMarkers(ctx, inv);

    ctx.restore();

    drawMapLabels(ctx);
    positionBalloon();
}

function drawMapGrid(ctx, inv) {
    ctx.strokeStyle = "rgba(30, 58, 138, 0.06)";
    ctx.lineWidth = 1 * inv;
    for (let x = 0; x <= MAP_W; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, MAP_H);
        ctx.stroke();
    }
    for (let y = 0; y <= MAP_H; y += 80) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(MAP_W, y);
        ctx.stroke();
    }
    ctx.strokeStyle = "rgba(30, 58, 138, 0.12)";
    ctx.lineWidth = 2 * inv;
    ctx.strokeRect(0, 0, MAP_W, MAP_H);
}

function drawMapRiver(ctx, inv) {
    ctx.beginPath();
    ctx.moveTo(60, 1120);
    ctx.lineTo(60, 1020);
    ctx.quadraticCurveTo(300, 1000, 520, 968);
    ctx.quadraticCurveTo(840, 915, 1080, 838);
    ctx.quadraticCurveTo(1320, 756, 1440, 520);
    ctx.quadraticCurveTo(1520, 300, 1640, 150);
    ctx.lineTo(1640, 1120);
    ctx.closePath();
    const waterGradient = ctx.createLinearGradient(200, 1100, 1500, 300);
    waterGradient.addColorStop(0, "#4f9bf2");
    waterGradient.addColorStop(1, "#8cc4fb");
    ctx.fillStyle = waterGradient;
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.32)";
    ctx.lineWidth = 3 * inv;
    const ripples = [[420, 1010, 740, 950], [760, 905, 1080, 800], [1080, 770, 1340, 600]];
    ripples.forEach(line => {
        ctx.beginPath();
        ctx.moveTo(line[0], line[1]);
        ctx.quadraticCurveTo((line[0] + line[2]) / 2, line[1] - 26, line[2], line[3]);
        ctx.stroke();
    });
}

function drawMapAvenues(ctx, inv) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    MAP_AVENUES.forEach(avenue => {
        ctx.beginPath();
        ctx.moveTo(avenue.pts[0][0], avenue.pts[0][1]);
        for (let i = 1; i < avenue.pts.length; i++) {
            ctx.lineTo(avenue.pts[i][0], avenue.pts[i][1]);
        }
        ctx.strokeStyle = "rgba(29, 78, 216, 0.16)";
        ctx.lineWidth = 15 * inv;
        ctx.stroke();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
        ctx.lineWidth = 5 * inv;
        ctx.stroke();
    });
}

function drawMapMarkers(ctx, inv) {
    const baseRadius = 9;
    for (const marker of mapState.markers) {
        const isSelected = mapState.selected === marker;
        const isHovered = mapState.hovered === marker;
        const radius = (isSelected ? baseRadius + 2 : baseRadius) * inv;

        ctx.beginPath();
        ctx.arc(marker.x, marker.y, radius * 2.1, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(14, 165, 233, 0.18)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(marker.x, marker.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(marker.x, marker.y, radius * 0.66, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? "#1d4ed8" : (isHovered ? "#0284c7" : "#0ea5e9");
        ctx.fill();

        ctx.beginPath();
        ctx.arc(marker.x, marker.y, radius * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();

        if (isSelected) {
            ctx.beginPath();
            ctx.arc(marker.x, marker.y, radius * 1.55, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(29, 78, 216, 0.6)";
            ctx.lineWidth = 2 * inv;
            ctx.stroke();
        }
    }
}

function drawMapLabels(ctx) {
    ctx.setTransform(mapState.dpr, 0, 0, mapState.dpr, 0, 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = "700 12px 'Segoe UI', sans-serif";
    ctx.fillStyle = "rgba(30, 58, 138, 0.30)";
    MAP_DISTRICTS.forEach(district => {
        const screen = worldToScreen(district.x, district.y);
        if (screen.x < -60 || screen.x > mapState.width + 60 || screen.y < -20 || screen.y > mapState.height + 20) return;
        ctx.fillText(district.name.toUpperCase(), screen.x, screen.y);
    });

    ctx.font = "600 11px 'Segoe UI', sans-serif";
    ctx.fillStyle = "rgba(30, 58, 138, 0.5)";
    MAP_AVENUES.forEach(avenue => {
        const mid = avenue.pts[Math.floor(avenue.pts.length / 2)];
        const screen = worldToScreen(mid[0], mid[1]);
        if (screen.x < 0 || screen.x > mapState.width || screen.y < 0 || screen.y > mapState.height) return;
        ctx.fillText(avenue.name, screen.x, screen.y - 11);
    });

    const riverScreen = worldToScreen(1250, 736);
    ctx.save();
    ctx.translate(riverScreen.x, riverScreen.y);
    ctx.rotate(-0.62);
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.font = "700 18px 'Segoe UI', sans-serif";
    ctx.fillText("р. Волга", 0, 0);
    ctx.restore();

    const hovered = mapState.hovered;
    if (hovered && hovered !== mapState.selected) {
        const screen = worldToScreen(hovered.x, hovered.y);
        const label = hovered.user.username || "";
        ctx.font = "700 12.5px 'Segoe UI', sans-serif";
        const width = ctx.measureText(label).width + 18;
        const height = 22;
        const boxX = screen.x - width / 2;
        const boxY = screen.y - 36;
        roundRect(ctx, boxX, boxY, width, height, 7);
        ctx.fillStyle = "rgba(11, 31, 77, 0.92)";
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, screen.x, boxY + height / 2);
    }

    if (mapState.markers.length === 0) {
        ctx.fillStyle = "rgba(30, 58, 138, 0.45)";
        ctx.font = "600 15px 'Segoe UI', sans-serif";
        ctx.fillText("Нет зарегистрированных жильцов в базе", mapState.width / 2, mapState.height / 2);
    }
}
