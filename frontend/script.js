// =============================================
// CONFIGURACIÓN
// =============================================
const ADMIN_WHATSAPP_NUMBER = '521XXXXXXXXX'; // ⚠️ Cambia por el número del administrador (código de país + número)

let authToken = localStorage.getItem('authToken') || '';
let isAdmin = false;
let currentRifaId = null;
let rifas = [];
let allBoletos = [];
let selectedNumbers = [];
let banners = [];
let selectedBoletoForEdit = null;

const PLACEHOLDER_IMAGE = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">' +
    '<rect width="400" height="200" fill="#cccccc"/>' +
    '<text x="200" y="110" font-family="Arial" font-size="24" fill="#ffffff" text-anchor="middle">Sin Imagen</text>' +
    '</svg>'
);

function getElement(id) {
    return document.getElementById(id);
}

async function apiFetch(url, options = {}) {
    const headers = { ...options.headers };
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
        authToken = '';
        localStorage.removeItem('authToken');
        isAdmin = false;
        showLogin();
        throw new Error('Sesión expirada');
    }
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(error.error || 'Error de servidor');
    }
    return response.json();
}

// ============ AUTENTICACIÓN ============
async function loginAdmin() {
    const username = getElement('adminUsername').value.trim();
    const password = getElement('adminPassword').value;
    try {
        const data = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        }).then(r => r.json());
        if (data.token) {
            authToken = data.token;
            localStorage.setItem('authToken', authToken);
            isAdmin = true;
            closeLogin();
            switchView('admin');
            await loadAdminData();
        } else {
            alert(data.error || 'Credenciales inválidas');
        }
    } catch (err) {
        alert('Error de conexión');
    }
}

function logout() {
    authToken = '';
    localStorage.removeItem('authToken');
    isAdmin = false;
    switchView('public');
}

function showLogin() {
    getElement('loginModal').classList.add('active');
}

function closeLogin() {
    getElement('loginModal').classList.remove('active');
    getElement('adminPassword').value = '';
}

// ============ CAMBIO DE VISTA ============
function switchView(view) {
    const publicView = getElement('publicView');
    const adminView = getElement('adminView');
    const navTab = document.querySelector('.nav-tab');
    const cartSummary = getElement('cartSummary');

    if (view === 'public') {
        publicView.classList.add('active');
        adminView.classList.remove('active');
        navTab?.classList.add('active');
        if (cartSummary) cartSummary.style.display = selectedNumbers.length > 0 ? 'flex' : 'none';
        loadPublicData();
    } else if (view === 'admin' && isAdmin) {
        publicView.classList.remove('active');
        adminView.classList.add('active');
        navTab?.classList.remove('active');
        if (cartSummary) cartSummary.style.display = 'none';
        loadAdminData();
    }
}

// ============ CARGA DE DATOS ============
async function loadPublicData() {
    try {
        const [rifasData, bannersData] = await Promise.all([
            apiFetch('/api/rifas'),
            apiFetch('/api/banners')
        ]);
        rifas = rifasData;
        banners = bannersData;
        renderRifasShowcase();
        updateBannerDisplay();
    } catch (err) {
        console.error('Error cargando datos públicos:', err);
    }
}

async function loadAdminData() {
    try {
        const [rifasData, bannersData] = await Promise.all([
            apiFetch('/api/rifas'),
            apiFetch('/api/banners')
        ]);
        rifas = rifasData;
        banners = bannersData;
        const boletosMap = new Map();
        for (const rifa of rifas) {
            const boletosRifa = await apiFetch(`/api/boletos/rifa/${rifa.id}`);
            boletosRifa.forEach(b => {
                if (b.id && !boletosMap.has(b.id)) {
                    boletosMap.set(b.id, b);
                }
            });
        }
        allBoletos = Array.from(boletosMap.values());
        updateAdminStats();
        renderAdminRifaFilter();
        renderAdminGrid();
        updateBannerDisplay();
    } catch (err) {
        console.error('Error cargando datos admin:', err);
    }
}

// ============ RENDER PÚBLICO ============
function renderRifasShowcase() {
    const container = getElement('rifasShowcase');
    if (!container) return;
    container.innerHTML = '';

    rifas.forEach(rifa => {
        const isExpired = new Date(rifa.date) < new Date();
        const total = rifa.total_boletos;
        const available = rifa.available_boletos || 0;

        const card = document.createElement('div');
        card.className = 'rifa-card';
        card.innerHTML = `
            <img src="${rifa.image_url || PLACEHOLDER_IMAGE}" class="rifa-image" alt="${rifa.name}" 
                 onerror="this.src='${PLACEHOLDER_IMAGE}'">
            <div class="rifa-badge">${rifa.badge || ''}</div>
            <div class="rifa-content">
                <h3 class="rifa-title">${rifa.name}</h3>
                <p class="rifa-description">${rifa.description || ''}</p>
                <div class="rifa-price">$${rifa.price} por número</div>
                <div class="rifa-stats">
                    <div class="rifa-stat">
                        <div class="rifa-stat-value" id="rifa${rifa.id}Available">${available}</div>
                        <div class="rifa-stat-label">Disponibles</div>
                    </div>
                    <div class="rifa-stat">
                        <div class="rifa-stat-value" id="rifa${rifa.id}Total">${total}</div>
                        <div class="rifa-stat-label">Total</div>
                    </div>
                </div>
                ${!isExpired ? `
                    <div class="countdown-timer" id="countdown_${rifa.id}">
                        <div class="countdown-item">
                            <div class="countdown-value" id="rifa${rifa.id}_days">0</div>
                            <div class="countdown-label">Días</div>
                        </div>
                        <div class="countdown-item">
                            <div class="countdown-value" id="rifa${rifa.id}_hours">0</div>
                            <div class="countdown-label">Horas</div>
                        </div>
                        <div class="countdown-item">
                            <div class="countdown-value" id="rifa${rifa.id}_minutes">0</div>
                            <div class="countdown-label">Min</div>
                        </div>
                    </div>
                ` : `
                    <div class="rifa-expired">⏰ Rifa finalizada</div>
                `}
                <button class="btn btn-primary btn-block" onclick="selectRifa(${rifa.id})" ${isExpired ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
                    ${isExpired ? 'Finalizada' : '🎯 Seleccionar Números'}
                </button>
            </div>
        `;
        container.appendChild(card);
    });

    updateCountdowns();
}

async function selectRifa(rifaId) {
    const rifa = rifas.find(r => r.id === rifaId);
    if (!rifa || new Date(rifa.date) < new Date()) {
        alert('⚠️ Esta rifa ha finalizado');
        return;
    }
    currentRifaId = rifaId;
    selectedNumbers = [];

    getElement('rifasShowcase').style.display = 'none';
    getElement('numbersSection').style.display = 'block';
    getElement('selectedRifaTitle').textContent = 
        `Selecciona tus Números - ${rifa.name} (Precio: $${rifa.price})`;

    try {
        const boletos = await apiFetch(`/api/boletos/rifa/${rifaId}`);
        window.currentBoletos = boletos;
        renderPublicGrid();
        updatePublicStats(boletos);
    } catch (err) {
        alert('Error al cargar boletos');
    }

    getElement('numbersSection').scrollIntoView({ behavior: 'smooth' });
}

function goBackToRifas() {
    getElement('rifasShowcase').style.display = 'grid';
    getElement('numbersSection').style.display = 'none';
    selectedNumbers = [];
    currentRifaId = null;
    updateStats();
    loadPublicData();
}

function renderPublicGrid(searchTerm = '') {
    const grid = getElement('publicGrid');
    if (!grid) return;
    const boletos = window.currentBoletos || [];
    const search = searchTerm || getElement('publicSearch').value;
    const filtered = boletos.filter(b => {
        if (search) return b.number.toString().includes(search);
        return true;
    });

    grid.innerHTML = '';
    filtered.forEach(boleto => {
        const cell = document.createElement('div');
        let className = 'number-cell ';
        if (selectedNumbers.includes(boleto.number)) {
            className += 'seleccionado';
        } else {
            className += boleto.status;
        }
        cell.className = className;
        cell.textContent = boleto.number;
        cell.addEventListener('click', () => showNumberDetail(boleto));
        grid.appendChild(cell);
    });
}

function showNumberDetail(boleto) {
    const infoDiv = getElement('numberDetailInfo');
    const actionsDiv = getElement('numberDetailActions');
    const isSelected = selectedNumbers.includes(boleto.number);
    const isAvailable = boleto.status === 'disponible';

    infoDiv.innerHTML = `
        <p><strong>Número:</strong> ${boleto.number}</p>
        <p><strong>Precio:</strong> $${boleto.price || rifas.find(r => r.id === boleto.rifa_id)?.price || 0}</p>
        <p><strong>Estado:</strong> ${boleto.status}</p>
        ${boleto.contenido ? `<p><strong>Contenido:</strong> ${boleto.contenido}</p>` : '<p><em>Sin contenido adicional</em></p>'}
    `;

    if (isAvailable) {
        if (isSelected) {
            actionsDiv.innerHTML = `
                <button class="btn btn-danger" onclick="toggleNumberSelection(${boleto.number}); closeModal('numberDetailModal');">🗑️ Deseleccionar</button>
                <button class="btn btn-secondary" onclick="closeModal('numberDetailModal')">Cerrar</button>
            `;
        } else {
            actionsDiv.innerHTML = `
                <button class="btn btn-primary" onclick="toggleNumberSelection(${boleto.number}); closeModal('numberDetailModal');">✅ Seleccionar</button>
                <button class="btn btn-secondary" onclick="closeModal('numberDetailModal')">Cerrar</button>
            `;
        }
    } else {
        actionsDiv.innerHTML = `
            <p>Este número no está disponible.</p>
            <button class="btn btn-secondary" onclick="closeModal('numberDetailModal')">Cerrar</button>
        `;
    }
    getElement('numberDetailModal').classList.add('active');
}

function toggleNumberSelection(number) {
    const index = selectedNumbers.indexOf(number);
    if (index > -1) {
        selectedNumbers.splice(index, 1);
    } else {
        const boleto = (window.currentBoletos || []).find(b => b.number === number);
        if (boleto && boleto.status === 'disponible') {
            selectedNumbers.push(number);
        }
    }
    updateStats();
    renderPublicGrid(getElement('publicSearch').value);
}

function updatePublicStats(boletos) {
    const disponibles = boletos.filter(b => b.status === 'disponible').length;
    if (getElement('publicAvailable')) getElement('publicAvailable').textContent = disponibles;
}

function updateStats() {
    if (getElement('selectedCount')) getElement('selectedCount').textContent = selectedNumbers.length;
    if (getElement('buyButtonCount')) getElement('buyButtonCount').textContent = selectedNumbers.length;
    if (getElement('cartCount')) getElement('cartCount').textContent = selectedNumbers.length;
    const cartSummary = getElement('cartSummary');
    if (cartSummary) cartSummary.style.display = selectedNumbers.length > 0 ? 'flex' : 'none';
}

// ============ CHECKOUT ============
function showCheckout() {
    if (selectedNumbers.length === 0) {
        alert('⚠️ No has seleccionado ningún número');
        return;
    }
    const listContainer = getElement('selectedNumbersList');
    listContainer.innerHTML = '<h3>📋 Números seleccionados:</h3>';
    const boletos = window.currentBoletos || [];
    selectedNumbers.sort((a, b) => a - b).forEach(num => {
        const boleto = boletos.find(b => b.number === num);
        const div = document.createElement('div');
        div.style.cssText = 'display:flex; justify-content:space-between; padding:12px; background:#f0f4ff; margin:8px 0; border-radius:8px;';
        div.innerHTML = `
            <span>Número: <strong>${num}</strong>${boleto?.contenido ? ` - <em>${boleto.contenido}</em>` : ''}</span>
            <span>Precio: <strong>$${boleto?.price || 0}</strong></span>
        `;
        listContainer.appendChild(div);
    });
    getElement('checkoutModal').classList.add('active');
}

function calcularTotal() {
    const boletos = window.currentBoletos || [];
    let total = 0;
    selectedNumbers.forEach(num => {
        const boleto = boletos.find(b => b.number === num);
        if (boleto) {
            const price = Number(boleto.price);
            if (!isNaN(price)) {
                total += price;
            }
        }
    });
    return total.toFixed(2);
}

async function confirmPurchase() {
    const clientName = getElement('clientName').value.trim();
    const clientPhone = getElement('clientPhone').value.trim();
    if (!clientName || !clientPhone) {
        alert('⚠️ Por favor ingresa nombre y teléfono');
        return;
    }
    try {
        await apiFetch('/api/boletos/reserve', {
            method: 'POST',
            body: JSON.stringify({
                rifaId: currentRifaId,
                numbers: selectedNumbers,
                name: clientName,
                phone: clientPhone,
                email: getElement('clientEmail').value.trim()
            })
        });
        alert('✅ ¡Números reservados exitosamente!');

        const rifaActual = rifas.find(r => r.id === currentRifaId);
        const mensajeAdmin = [
            '🔔 *Nueva reserva recibida*',
            `*Cliente:* ${clientName}`,
            `*Teléfono:* ${clientPhone}`,
            `*Rifa:* ${rifaActual?.name || 'N/D'}`,
            `*Números:* ${selectedNumbers.join(', ')}`,
            `*Total a pagar:* $${calcularTotal()}`
        ].join('\n');

        openWhatsApp(ADMIN_WHATSAPP_NUMBER, mensajeAdmin);

        clearCart();
        closeModal('checkoutModal');
        goBackToRifas();
    } catch (err) {
        alert(err.message);
    }
}

function clearCart() {
    selectedNumbers = [];
    updateStats();
    renderPublicGrid(getElement('publicSearch').value);
    getElement('clientName').value = '';
    getElement('clientPhone').value = '';
    getElement('clientEmail').value = '';
}

// ============ WHATSAPP ============
function openWhatsApp(phone, message) {
    const cleanPhone = String(phone).replace(/\D/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

function sendPaymentConfirmation(phone, number, rifaName) {
    if (!phone) {
        alert('No hay teléfono del comprador');
        return;
    }
    const message = `Hola, te confirmamos que el pago del boleto número ${number} de la rifa "${rifaName}" ha sido recibido. ¡Tu participación está asegurada! 🎉`;
    openWhatsApp(phone, message);
}

// ============ CONTADOR ============
function startCountdown() {
    updateCountdowns();
    setInterval(updateCountdowns, 60000);
}
function updateCountdowns() {
    rifas.forEach(rifa => {
        const diff = new Date(rifa.date) - new Date();
        if (diff > 0) {
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const dEl = getElement(`rifa${rifa.id}_days`);
            const hEl = getElement(`rifa${rifa.id}_hours`);
            const mEl = getElement(`rifa${rifa.id}_minutes`);
            if (dEl) dEl.textContent = days;
            if (hEl) hEl.textContent = hours;
            if (mEl) mEl.textContent = minutes;
        }
    });
}

// ============ ADMIN: RIFAS ============
function renderAdminRifaFilter() {
    const select = getElement('adminRifaFilter');
    if (!select) return;
    select.innerHTML = '<option value="all">Todas las rifas</option>';
    rifas.forEach(rifa => {
        const opt = document.createElement('option');
        opt.value = rifa.id;
        opt.textContent = rifa.name;
        select.appendChild(opt);
    });
}

function renderAdminGrid(searchTerm = '') {
    const grid = getElement('adminGrid');
    if (!grid) return;
    const filterRifa = getElement('adminRifaFilter').value;
    const search = searchTerm || getElement('adminSearch').value;
    const boletosFiltrados = allBoletos.filter(b => {
        if (filterRifa !== 'all' && b.rifa_id != filterRifa) return false;
        if (search) {
            return b.number.toString().includes(search) ||
                   (b.buyer_name && b.buyer_name.toLowerCase().includes(search.toLowerCase())) ||
                   (b.contenido && b.contenido.toLowerCase().includes(search.toLowerCase()));
        }
        return true;
    });

    grid.innerHTML = '';
    if (filterRifa === 'all') {
        const grupos = {};
        boletosFiltrados.forEach(b => {
            if (!grupos[b.rifa_id]) grupos[b.rifa_id] = [];
            grupos[b.rifa_id].push(b);
        });
        Object.keys(grupos).forEach(rifaId => {
            const rifa = rifas.find(r => r.id == rifaId);
            const groupDiv = document.createElement('div');
            groupDiv.className = 'rifa-group';
            const header = document.createElement('div');
            header.className = 'rifa-group-header';
            header.textContent = `${rifa ? rifa.name : 'Rifa ' + rifaId} (${grupos[rifaId].length} números)`;
            groupDiv.appendChild(header);
            const groupGrid = document.createElement('div');
            groupGrid.className = 'grid-container';
            grupos[rifaId].forEach(b => {
                const cell = document.createElement('div');
                cell.className = `number-cell ${b.status}`;
                cell.textContent = b.number;
                cell.title = `Número ${b.number} - ${b.status}${b.buyer_name ? ' - ' + b.buyer_name : ''}${b.contenido ? ' - ' + b.contenido : ''}`;
                cell.addEventListener('click', () => openEditBoleto(b));
                cell.addEventListener('contextmenu', (e) => { e.preventDefault(); quickToggleBoleto(b); });
                groupGrid.appendChild(cell);
            });
            groupDiv.appendChild(groupGrid);
            grid.appendChild(groupDiv);
        });
    } else {
        const groupGrid = document.createElement('div');
        groupGrid.className = 'grid-container';
        boletosFiltrados.forEach(b => {
            const cell = document.createElement('div');
            cell.className = `number-cell ${b.status}`;
            cell.textContent = b.number;
            cell.title = `Número ${b.number} - ${b.status}${b.buyer_name ? ' - ' + b.buyer_name : ''}${b.contenido ? ' - ' + b.contenido : ''}`;
            cell.addEventListener('click', () => openEditBoleto(b));
            cell.addEventListener('contextmenu', (e) => { e.preventDefault(); quickToggleBoleto(b); });
            groupGrid.appendChild(cell);
        });
        grid.appendChild(groupGrid);
    }
}

function updateAdminStats() {
    const disponibles = allBoletos.filter(b => b.status === 'disponible').length;
    const vendidos = allBoletos.filter(b => b.status === 'vendido').length;
    const reservados = allBoletos.filter(b => b.status === 'reservado').length;
    const revenue = allBoletos.filter(b => b.status === 'vendido')
                            .reduce((sum, b) => sum + (parseFloat(b.price) || 0), 0);
    setText('totalNumbers', allBoletos.length);
    setText('availableCount', disponibles);
    setText('soldCount', vendidos);
    setText('reservedCount', reservados);
    setText('totalRevenue', '$' + revenue.toFixed(2));
}

function setText(id, value) {
    const el = getElement(id);
    if (el) el.textContent = value;
}

// ============ ADMIN: EDITAR BOLETO ============
function openEditBoleto(boleto) {
    selectedBoletoForEdit = boleto;
    const rifaName = rifas.find(r => r.id == boleto.rifa_id)?.name || '';
    getElement('modalTitle').textContent = `Editar Número ${boleto.number} - ${rifaName}`;
    getElement('editNumber').value = boleto.number;
    getElement('editStatus').value = boleto.status;
    getElement('editBuyer').value = boleto.buyer_name || '';
    getElement('editPhone').value = boleto.phone || '';
    getElement('editDate').value = boleto.sale_date || '';
    getElement('editPrice').value = boleto.price || '';
    getElement('editContent').value = boleto.contenido || '';
    
    const modalContent = document.querySelector('#editModal .modal-content');
    const oldBtn = document.getElementById('whatsappConfirmBtn');
    if (oldBtn) oldBtn.remove();
    
    const whatsappBtn = document.createElement('button');
    whatsappBtn.id = 'whatsappConfirmBtn';
    whatsappBtn.className = 'btn btn-success btn-block';
    whatsappBtn.textContent = '📲 Enviar confirmación de pago por WhatsApp';
    whatsappBtn.onclick = () => sendPaymentConfirmation(boleto.phone, boleto.number, rifaName);
    modalContent.appendChild(whatsappBtn);
    
    getElement('editModal').classList.add('active');
}

async function saveEdit() {
    if (!selectedBoletoForEdit) return;
    const saleDate = getElement('editDate').value.trim();
    const data = {
        status: getElement('editStatus').value,
        buyer_name: getElement('editBuyer').value.trim(),
        phone: getElement('editPhone').value.trim(),
        sale_date: saleDate === '' ? null : saleDate,
        price: parseFloat(getElement('editPrice').value) || 0,
        contenido: getElement('editContent').value.trim()
    };
    try {
        await apiFetch(`/api/boletos/${selectedBoletoForEdit.id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        closeModal('editModal');
        selectedBoletoForEdit = null;
        await loadAdminData();
        alert('✅ Boleto actualizado');
    } catch (err) {
        alert(err.message);
    }
}

async function quickToggleBoleto(boleto) {
    let newStatus;
    let saleDate = boleto.sale_date;
    if (boleto.status === 'disponible') {
        newStatus = 'vendido';
        saleDate = new Date().toISOString().split('T')[0];
    } else if (boleto.status === 'vendido') {
        newStatus = 'reservado';
        saleDate = null;
    } else {
        newStatus = 'disponible';
        saleDate = null;
    }
    try {
        await apiFetch(`/api/boletos/${boleto.id}`, {
            method: 'PUT',
            body: JSON.stringify({
                status: newStatus,
                buyer_name: boleto.buyer_name,
                phone: boleto.phone,
                sale_date: saleDate,
                price: boleto.price,
                contenido: boleto.contenido
            })
        });
        await loadAdminData();
    } catch (err) {
        alert(err.message);
    }
}

// ============ ADMIN: RIFAS (CRUD) ============
function showEditRifas() {
    const container = getElement('rifasEditList');
    container.innerHTML = '';
    rifas.forEach(rifa => {
        const card = document.createElement('div');
        card.className = 'rifa-edit-card';
        card.innerHTML = `
            <img src="${rifa.image_url || PLACEHOLDER_IMAGE}" class="rifa-edit-image" alt="${rifa.name}" 
                 onerror="this.src='${PLACEHOLDER_IMAGE}'">
            <div class="rifa-edit-info">
                <div class="rifa-edit-name">${rifa.name}</div>
                <div class="rifa-edit-details">
                    Precio: $${rifa.price} | Boletos: ${rifa.total_boletos} | 
                    Fecha: ${new Date(rifa.date).toLocaleString()}
                </div>
            </div>
            <div class="rifa-edit-actions">
                <button class="btn btn-info" onclick="editRifa(${rifa.id})">✏️ Editar</button>
                <button class="btn btn-danger" onclick="deleteRifa(${rifa.id})">🗑️ Eliminar</button>
            </div>
        `;
        container.appendChild(card);
    });
    getElement('editRifasModal').classList.add('active');
}

function showCreateRifa() {
    getElement('editSingleRifaTitle').textContent = 'Nueva Rifa';
    getElement('editRifaId').value = '';
    getElement('editRifaName').value = '';
    getElement('editRifaDescription').value = '';
    getElement('editRifaBadge').value = '';
    getElement('editRifaDate').value = '';
    getElement('editRifaTotal').value = 100;
    getElement('editRifaPrice').value = 10;
    getElement('rifaImagePreview').innerHTML = '';
    getElement('editRifaImage').value = '';
    closeModal('editRifasModal');
    getElement('editSingleRifaModal').classList.add('active');
}

function editRifa(id) {
    const rifa = rifas.find(r => r.id === id);
    if (!rifa) return;
    getElement('editSingleRifaTitle').textContent = 'Editar Rifa';
    getElement('editRifaId').value = rifa.id;
    getElement('editRifaName').value = rifa.name;
    getElement('editRifaDescription').value = rifa.description || '';
    getElement('editRifaBadge').value = rifa.badge || '';
    getElement('editRifaDate').value = rifa.date;
    getElement('editRifaTotal').value = rifa.total_boletos;
    getElement('editRifaPrice').value = rifa.price;
    getElement('rifaImagePreview').innerHTML = `<img src="${rifa.image_url || PLACEHOLDER_IMAGE}" class="rifa-image-preview">`;
    getElement('editRifaImage').value = '';
    closeModal('editRifasModal');
    getElement('editSingleRifaModal').classList.add('active');
}

function previewRifaImage() {
    const file = getElement('editRifaImage').files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => getElement('rifaImagePreview').innerHTML = `<img src="${e.target.result}" class="rifa-image-preview">`;
        reader.readAsDataURL(file);
    }
}

async function uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Error al subir imagen');
    }
    const data = await response.json();
    return data.url;
}

async function saveSingleRifa() {
    const id = getElement('editRifaId').value;
    const name = getElement('editRifaName').value.trim();
    const description = getElement('editRifaDescription').value.trim();
    const badge = getElement('editRifaBadge').value.trim();
    const date = getElement('editRifaDate').value;
    const total = parseInt(getElement('editRifaTotal').value);
    const price = parseFloat(getElement('editRifaPrice').value);
    
    if (!name || !date || !total || !price) {
        alert('Por favor completa todos los campos');
        return;
    }
    if (new Date(date) <= new Date()) {
        alert('La fecha debe ser futura');
        return;
    }
    
    let image_url = null;
    const fileInput = getElement('editRifaImage');
    if (fileInput.files.length > 0) {
        image_url = await uploadImage(fileInput.files[0]);
    } else if (id) {
        image_url = rifas.find(r => r.id == id)?.image_url || null;
    }
    
    const data = { name, description, price, total_boletos: total, image_url, badge, date };
    try {
        if (id) {
            await apiFetch(`/api/rifas/${id}`, { method: 'PUT', body: JSON.stringify(data) });
        } else {
            await apiFetch('/api/rifas', { method: 'POST', body: JSON.stringify(data) });
        }
        closeModal('editSingleRifaModal');
        await loadAdminData();
        await loadPublicData();
        alert('✅ Rifa guardada correctamente');
    } catch (err) {
        alert(err.message);
    }
}

async function deleteRifa(id) {
    if (!confirm('¿Estás seguro de eliminar esta rifa? Se borrarán también todos sus boletos.')) {
        return;
    }
    try {
        await apiFetch(`/api/rifas/${id}`, { method: 'DELETE' });
        await loadAdminData();
        await loadPublicData();
        alert('✅ Rifa eliminada correctamente');
    } catch (err) {
        alert(err.message);
    }
}

// ============ ADMIN: BANNERS ============
function showBannerManagement() {
    renderBannerList();
    getElement('bannerModal').classList.add('active');
}

function renderBannerList() {
    const container = getElement('bannerList');
    container.innerHTML = '';
    banners.forEach(banner => {
        const div = document.createElement('div');
        div.style.cssText = 'border:2px solid #ddd; border-radius:10px; overflow:hidden; margin-bottom:15px;';
        div.innerHTML = `
            <img src="${banner.image_url || PLACEHOLDER_IMAGE}" style="width:100%; height:150px; object-fit:cover;" alt="${banner.title}">
            <div style="padding:15px;">
                <h4>${banner.title}</h4>
                <p>Estado: ${banner.active ? '✅ Activo' : '❌ Inactivo'}</p>
                <div style="display:flex; gap:10px; margin-top:10px;">
                    <button class="btn btn-info" onclick="toggleBanner(${banner.id})">${banner.active ? 'Desactivar' : 'Activar'}</button>
                    <button class="btn btn-danger" onclick="deleteBanner(${banner.id})">Eliminar</button>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

function previewBannerImage() {
    const file = getElement('bannerImage').files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            const img = getElement('bannerPreview');
            img.src = e.target.result;
            img.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

async function addBanner() {
    const title = getElement('bannerTitle').value.trim();
    const fileInput = getElement('bannerImage');
    const link = getElement('bannerLink').value.trim();
    if (!fileInput.files[0]) {
        alert('Selecciona una imagen');
        return;
    }

    try {
        const image_url = await uploadImage(fileInput.files[0]);

        await apiFetch('/api/banners', {
            method: 'POST',
            body: JSON.stringify({ title, image_url, link, active: true })
        });

        getElement('bannerTitle').value = '';
        getElement('bannerLink').value = '';
        getElement('bannerImage').value = '';
        getElement('bannerPreview').style.display = 'none';

        await loadAdminData();
        alert('✅ Banner agregado');
    } catch (err) {
        alert(err.message);
    }
}

async function toggleBanner(id) {
    const banner = banners.find(b => b.id === id);
    if (!banner) return;
    try {
        await apiFetch(`/api/banners/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ ...banner, active: !banner.active })
        });
        await loadAdminData();
    } catch (err) {
        alert(err.message);
    }
}

async function deleteBanner(id) {
    if (confirm('¿Eliminar banner?')) {
        try {
            await apiFetch(`/api/banners/${id}`, { method: 'DELETE' });
            await loadAdminData();
        } catch (err) {
            alert(err.message);
        }
    }
}

function updateBannerDisplay() {
    const header = getElement('headerBanner');
    const activeBanner = banners.find(b => b.active);
    if (activeBanner) {
        header.innerHTML = `<img src="${activeBanner.image_url}" alt="${activeBanner.title}" style="width:100%; height:100%; object-fit:cover;">
            <div class="banner-overlay"><div class="banner-title">${activeBanner.title}</div></div>`;
    } else {
        header.innerHTML = `<div class="banner-overlay"><div class="banner-title">🎰 LOTERÍA PREMIUM</div><div class="banner-subtitle">¡Tu oportunidad de ganar!</div></div>`;
    }
}

// ============ REPORTE ============
function showReport() {
    const tbody = getElement('reportTable');
    tbody.innerHTML = '';
    const vendidos = allBoletos.filter(b => b.status !== 'disponible');
    if (vendidos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8">No hay números vendidos o reservados</td></tr>';
    } else {
        vendidos.forEach(b => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${b.number} (${rifas.find(r => r.id == b.rifa_id)?.name || b.rifa_id})</td>
                <td>${b.buyer_name || 'N/A'}</td>
                <td>${b.phone || 'N/A'}</td>
                <td>${b.sale_date || b.reservation_date || 'N/A'}</td>
                <td>$${b.price || 0}</td>
                <td>${b.status === 'vendido' ? '✅ Vendido' : '⏳ Reservado'}</td>
                <td>${b.contenido || '—'}</td>
                <td>${b.phone ? `<button class="btn btn-info" onclick="openWhatsApp('${b.phone}', 'Hola ${b.buyer_name}, tu boleto ${b.number} está ${b.status}.')">💬</button>` : '—'}</td>
            `;
            tbody.appendChild(row);
        });
    }
    getElement('reportModal').classList.add('active');
}

// ============ FUNCIONES DE MODALES LEGALES ============
function openTermsModal() {
    getElement('termsModal').classList.add('active');
}

function openPrivacyModal() {
    getElement('privacyModal').classList.add('active');
}

// ============ EVENTOS ============
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'A') {
            e.preventDefault();
            showLogin();
        }
    });
    
    getElement('publicSearch').addEventListener('input', (e) => renderPublicGrid(e.target.value));
    getElement('adminSearch').addEventListener('input', (e) => renderAdminGrid(e.target.value));
    getElement('adminRifaFilter').addEventListener('change', () => renderAdminGrid());
    
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
    });
    
    loadPublicData();
    startCountdown();
    
    if (authToken) {
        isAdmin = true;
    }
});

function closeModal(modalId) {
    getElement(modalId).classList.remove('active');
}