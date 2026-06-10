const API_URL = "";
const BLUE_SCALE = ["#0b1f4d", "#1e40af", "#1d4ed8", "#2563eb", "#3b82f6", "#0ea5e9", "#60a5fa", "#93c5fd"];

let yandexMapsApiKey = "";
let yandexGeocoderApiKey = "";
let yandexConfigLoaded = false;

async function loadPublicConfig() {
    if (yandexConfigLoaded) {
        return { mapsKey: yandexMapsApiKey, geocoderKey: yandexGeocoderApiKey };
    }
    try {
        const response = await fetch(`${API_URL}/api/config`);
        if (response.ok) {
            const config = await response.json();
            yandexMapsApiKey = String(config.yandex_maps_api_key || "").trim();
            yandexGeocoderApiKey = String(config.yandex_geocoder_api_key || "").trim();
        }
    } catch (error) {
        yandexMapsApiKey = "";
        yandexGeocoderApiKey = "";
    }
    yandexConfigLoaded = true;
    return { mapsKey: yandexMapsApiKey, geocoderKey: yandexGeocoderApiKey };
}

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
    if (viewId === "view-admin") {
        setTimeout(() => resizeYandexMap(), 120);
    }
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

    initResidentsMap(users);
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

function normalizeStreet(value) {
    return String(value || "").toLowerCase().replace(/\./g, "").replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

function stripStreetPrefix(value) {
    return value.replace(/^(улица|ул|проспект|пр-кт|пр|переулок|пер|бульвар|б-р|шоссе|ш|проезд)\s+/, "").trim();
}

function hashString(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = (hash * 16777619) >>> 0;
    }
    return hash >>> 0;
}

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
let yandexResizeBound = false;

function bindYandexResize() {
    if (yandexResizeBound) return;
    yandexResizeBound = true;
    window.addEventListener("resize", () => resizeYandexMap());
}

function resizeYandexMap() {
    if (!yandexMapInstance) return;
    try {
        yandexMapInstance.container.fitToViewport();
    } catch (error) {
        void error;
    }
}

function setMapStatus(text, state) {
    const status = document.getElementById("map-status");
    if (!status) return;
    status.textContent = text;
    status.className = "map-status" + (state ? " " + state : "");
}

function showMapError(message) {
    const overlay = document.getElementById("map-error");
    if (!overlay) return;
    overlay.innerHTML = "<p>" + escapeHtml(message) + "</p>";
    overlay.style.display = "flex";
}

function hideMapError() {
    const overlay = document.getElementById("map-error");
    if (overlay) overlay.style.display = "none";
}

function loadYandexMaps(timeoutMs) {
    return loadPublicConfig().then(({ mapsKey }) => {
        if (!mapsKey) {
            return Promise.reject(new Error("missing api key"));
        }
        const scriptUrl = "https://api-maps.yandex.ru/2.1/?apikey=" + encodeURIComponent(mapsKey) + "&lang=ru_RU";
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
            let script = document.getElementById("yandex-maps-sdk");
            if (script && script.getAttribute("data-src") !== scriptUrl) {
                script.remove();
                script = null;
                delete window.ymaps;
            }
            if (window.ymaps && window.ymaps.Map && script && script.getAttribute("data-src") === scriptUrl) {
                ready();
                return;
            }
            if (!script) {
                script = document.createElement("script");
                script.id = "yandex-maps-sdk";
                script.src = scriptUrl;
                script.setAttribute("data-src", scriptUrl);
                script.async = true;
                document.head.appendChild(script);
            }
            script.addEventListener("load", ready, { once: true });
            script.addEventListener("error", () => finish(reject, new Error("script error")), { once: true });
        });
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

async function geocodeViaHttp(query, apiKey) {
    if (!apiKey) return null;
    try {
        const url = "https://geocode-maps.yandex.ru/1.x/?apikey=" + encodeURIComponent(apiKey)
            + "&geocode=" + encodeURIComponent(query)
            + "&format=json&results=1";
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        const member = data.response?.GeoObjectCollection?.featureMember?.[0];
        const pos = member?.GeoObject?.Point?.pos;
        if (!pos) return null;
        const parts = pos.split(" ").map(Number);
        return [parts[1], parts[0]];
    } catch (error) {
        void error;
        return null;
    }
}

async function resolveUserCoords(ymaps, user, geocoderKey) {
    const query = "Самара, " + composeAddress(user);
    const httpCoords = await geocodeViaHttp(query, geocoderKey);
    if (httpCoords) return httpCoords;
    try {
        const result = await ymaps.geocode(query, { results: 1 });
        const geoObject = result.geoObjects.get(0);
        if (geoObject) return geoObject.geometry.getCoordinates();
    } catch (error) {
        void error;
    }
    return latlngForUser(user) || offsetCenter(user);
}

function buildUserPlacemark(ymaps, user, coords) {
    const budgetText = Number(user.monthly_budget) > 0 ? formatMoney(user.monthly_budget) : "не задан";
    const body = '<div style="font-size:13px;line-height:1.7;">'
        + "<b>Адрес:</b> " + escapeHtml(composeAddress(user)) + "<br>"
        + "<b>Email:</b> " + escapeHtml(user.email || "—") + "<br>"
        + "<b>Лимит/мес:</b> " + budgetText + "</div>";
    return new ymaps.Placemark(coords, {
        balloonContentHeader: escapeHtml(user.username),
        balloonContentBody: body,
        hintContent: escapeHtml(user.username)
    }, {
        preset: "islands#blueDotIcon",
        iconColor: "#1d4ed8"
    });
}

async function renderYandexMap(ymaps, users) {
    const container = document.getElementById("yandexMap");
    if (!container) return;

    hideMapError();

    if (yandexMapInstance) {
        try { yandexMapInstance.destroy(); } catch (error) { void error; }
        yandexMapInstance = null;
    }
    container.innerHTML = "";

    yandexMapInstance = new ymaps.Map(container, {
        center: SAMARA_CENTER,
        zoom: 12,
        controls: ["zoomControl", "fullscreenControl"]
    }, {
        suppressMapOpenBlock: true,
        yandexMapDisablePoiInteractivity: true
    });

    bindYandexResize();

    const collection = new ymaps.GeoObjectCollection();
    const list = users || [];

    if (list.length === 0) {
        yandexMapInstance.geoObjects.add(collection);
        resizeYandexMap();
        return;
    }

    const { geocoderKey } = await loadPublicConfig();
    const placemarks = await Promise.all(list.map(async user => {
        const coords = await resolveUserCoords(ymaps, user, geocoderKey);
        return buildUserPlacemark(ymaps, user, coords);
    }));

    placemarks.forEach(placemark => collection.add(placemark));
    yandexMapInstance.geoObjects.add(collection);

    requestAnimationFrame(() => {
        if (!yandexMapInstance) return;
        resizeYandexMap();
        try {
            const bounds = collection.getBounds();
            if (bounds) {
                yandexMapInstance.setBounds(bounds, { checkZoomRange: true, zoomMargin: 50 });
            }
        } catch (error) {
            void error;
        }
        setTimeout(() => resizeYandexMap(), 200);
    });
}

async function initResidentsMap(users) {
    setMapStatus("Загрузка Яндекс.Карт...", "");
    hideMapError();
    try {
        const ymaps = await loadYandexMaps(15000);
        await renderYandexMap(ymaps, users || []);
        setMapStatus("Яндекс.Карты", "is-online");
    } catch (error) {
        const message = error && error.message === "missing api key"
            ? "Укажите YANDEX_MAPS_API_KEY в файле .env (см. .env.example)."
            : (error && error.message === "timeout"
                ? "Превышено время ожидания загрузки Яндекс.Карт. Проверьте интернет-соединение."
                : "Не удалось загрузить Яндекс.Карты. Проверьте ключ API и подключение к интернету.");
        setMapStatus("Ошибка загрузки", "is-error");
        showMapError(message);
    }
}
