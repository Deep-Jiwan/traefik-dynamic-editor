const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) ? window.APP_CONFIG.API_BASE : (window.location.protocol + '//' + window.location.host + '/api');
let ws;
let currentEditingRouter = null;
let pendingDeleteRouter = null;
let statusInterval = null;
const serviceState = {}; // per-service backoff state
const BASE_BACKOFF = 1000; // 1s
const MAX_BACKOFF = 180000; // 3 minutes

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadRouters();
    loadEntryPoints();
    connectWebSocket();
    setupFormHandlers();
    // initial polling will be started after routers are loaded
    setupRouterActionDelegation();
});

const upSvg = '<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" color="white" height="20" width="20" xmlns="http://www.w3.org/2000/svg" style="color: white;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
const downSvg = '<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" color="white" height="20" width="20" xmlns="http://www.w3.org/2000/svg" style="color: white;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';

// Sanitize router names for use in DOM ids
function sanitizeId(name) {
    if (!name) return '';
    // replace any character that is not alphanumeric, dash or underscore with a dash
    return 'r-' + name.replace(/[^a-zA-Z0-9-_]/g, '-');
}

function getStatusBadge(name) {
    const safe = sanitizeId(name);
    return document.getElementById(`status-badge-${safe}`);
}

function startStatusPolling(force = false) {
    // Reconcile current DOM rows with serviceState.
    // For any new service rows, initialize state and start an immediate check.
    // For services removed from the DOM, clear their timers and remove state.

    const rows = document.querySelectorAll('#routers-container tr');
    const present = new Set();

    rows.forEach((tr) => {
        const host = tr.getAttribute('data-host');
        const name = decodeURIComponent(tr.getAttribute('data-name'));
        const tlsAttr = tr.getAttribute('data-tls');
        if (!host || host === 'Unknown' || !name) return;

        present.add(name);

        const scheme = tlsAttr === 'true' ? 'https' : 'http';

        // If we already have state for this service, just ensure scheme is up-to-date
        if (serviceState[name]) {
            // update scheme
            serviceState[name].scheme = scheme;
            // if force is requested, reset backoff and trigger immediate recheck
            if (force) {
                if (serviceState[name].timer) {
                    clearTimeout(serviceState[name].timer);
                    serviceState[name].timer = null;
                }
                serviceState[name].backoff = BASE_BACKOFF;
                checkService(name, host, scheme);
            }
            return;
        }

        // initialize state and start immediate check
        serviceState[name] = { backoff: BASE_BACKOFF, timer: null, scheme: scheme };
        checkService(name, host, scheme);
    });

    // Clean up services that are no longer present in the DOM
    for (const name in serviceState) {
        if (!present.has(name)) {
            if (serviceState[name].timer) clearTimeout(serviceState[name].timer);
            delete serviceState[name];
        }
    }
}

// Setup event delegation for edit/delete buttons inside routers table
function setupRouterActionDelegation() {
    const container = document.getElementById('routers-container');
    if (!container) return;
    // Avoid attaching multiple times
    if (container.__delegationAttached) return;

    container.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit');
        if (editBtn) {
            const name = decodeURIComponent(editBtn.getAttribute('data-router'));
            editRouter(name);
            return;
        }

        const delBtn = e.target.closest('.btn-delete');
        if (delBtn) {
            const name = decodeURIComponent(delBtn.getAttribute('data-router'));
            deleteRouter(name);
            return;
        }
    });

    container.__delegationAttached = true;
}

function checkService(name, host, scheme) {
    const state = serviceState[name] || { backoff: BASE_BACKOFF, timer: null };

    fetch(`${API_BASE}/ping?host=${encodeURIComponent(host)}&scheme=${encodeURIComponent(scheme)}`)
        .then(res => res.json())
        .then(data => {
            const badge = getStatusBadge(name);
            if (!badge) return;
            if (data.status === 'up' && data.code === 200) {
                badge.classList.remove('status-down');
                badge.classList.add('status-up');
                badge.title = `Online — ${data.latency_ms} ms`;
                badge.innerHTML = `
                    <span class="status-icon">${upSvg}</span>
                    <span class="status-latency">${data.latency_ms}ms</span>
                `;
                // increase backoff (exponential) up to max
                state.backoff = Math.min(state.backoff * 2 || BASE_BACKOFF * 2, MAX_BACKOFF);
            } else {
                badge.classList.remove('status-up');
                badge.classList.add('status-down');
                const errMsg = data.error || (`Status ${data.code || 'unknown'}`);
                badge.title = `${errMsg}`;
                // show HTTP status code when available for failures, otherwise show generic ERR
                const codeOrErr = data.code ? data.code : (data.error ? 'ERR' : '-');
                badge.innerHTML = `
                    <span class="status-icon">${downSvg}</span>
                    <span class="status-latency">${codeOrErr}</span>
                `;
                // reset backoff on failure
                state.backoff = BASE_BACKOFF;
            }

            // schedule next check (use stored scheme)
            if (state.timer) clearTimeout(state.timer);
            state.timer = setTimeout(() => checkService(name, host, state.scheme), state.backoff);
            serviceState[name] = state;
        }).catch((err) => {
            const badge = getStatusBadge(name);
            if (!badge) return;
            badge.classList.remove('status-up');
            badge.classList.add('status-down');
            badge.title = `Unreachable: ${err && err.message ? err.message : ''}`;
            badge.innerHTML = `
                <span class="status-icon">${downSvg}</span>
                <span class="status-latency">ERR</span>
            `;
            // reset backoff
            state.backoff = BASE_BACKOFF;
            if (state.timer) clearTimeout(state.timer);
            state.timer = setTimeout(() => checkService(name, host, state.scheme), state.backoff);
            serviceState[name] = state;
        });
}

// WebSocket connection for real-time updates
function connectWebSocket() {
    ws = new WebSocket('ws://localhost:8010/api/ws');
    
    ws.onopen = () => {
        updateStatus('connected', 'Connected');
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'config-updated') {
            loadRouters();
            loadEntryPoints();
            showNotification('Configuration updated', 'info');
        }
    };

    ws.onclose = () => {
        updateStatus('disconnected', 'Disconnected');
        // Reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = () => {
        updateStatus('error', 'Error');
    };
}

function updateStatus(status, text) {
    const dot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const statusIndicator = document.getElementById('status-indicator');

    const dotColors = {
        connected: 'bg-green-500',
        disconnected: 'bg-gray-400',
        error: 'bg-red-500'
    };

    // Update small dot color
    dot.className = `w-2 h-2 rounded-full ${dotColors[status] || dotColors.disconnected}`;

    // Update container background + text color using status classes
    const baseClasses = 'flex items-center gap-2 px-3 py-2 rounded-lg';
    const statusClass = status === 'connected' ? 'status-connected' : (status === 'error' ? 'status-error' : 'status-disconnected');
    statusIndicator.className = `${baseClasses} ${statusClass}`;

    statusText.textContent = text;
}

// Load entry points
async function loadEntryPoints() {
    try {
        const response = await fetch(`${API_BASE}/entrypoints`);
        const entryPoints = await response.json();
        
        const container = document.getElementById('entrypoints-list');
        container.innerHTML = '';
        
        // Display entry points from traefik.yml
        Object.entries(entryPoints).forEach(([name, config]) => {
            const card = document.createElement('div');
            card.className = 'bg-entry-point rounded-xl p-6 transition-colors duration-200';
            card.innerHTML = `
                <div class="flex flex-col items-center justify-center gap-2">
                    <span class="text-xs font-semibold text-subtle uppercase tracking-wider">${name}</span>
                    <span class="text-2xl font-bold text-white">${config.address}</span>
                </div>
            `;
            container.appendChild(card);
        });
        
        // Add "+" button to add custom entry point
        const addCard = document.createElement('button');
        addCard.className = 'bg-custom-dark rounded-xl p-6 border-2 border-dashed border-custom-separator hover:border-custom-teal hover:bg-custom-table transition-colors duration-200';
        addCard.onclick = showAddEntryPointModal;
        addCard.innerHTML = `
            <div class="flex flex-col items-center justify-center gap-2">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                <span class="text-sm font-medium text-white">Add Entry Point</span>
            </div>
        `;
        container.appendChild(addCard);
    } catch (error) {
        console.error('Error loading entry points:', error);
    }
}

function showAddEntryPointModal() {
    showNotification('Entry points are defined in traefik.yml config file. Feature in progress', 'info');
}

// Load routers
async function loadRouters() {
    try {
        const response = await fetch(`${API_BASE}/routers`);
        const routers = await response.json();
        
        const container = document.getElementById('routers-container');
        const emptyState = document.getElementById('empty-state');

        if (Object.keys(routers || {}).length === 0) {
            container.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        container.innerHTML = Object.entries(routers).map(([name, router]) => createRouterCard(name, router)).join('');
        // Ensure status polling is initialized/reconciled for the newly rendered rows.
        // Pass `true` to force immediate rechecks and reset backoff for all services
        startStatusPolling(true);
    } catch (error) {
        console.error('Error loading routers:', error);
        showNotification('Failed to load routers', 'error');
    }
}

function createRouterCard(name, router) {
    const host = router.rule.match(/Host\(`([^`]+)`\)/)?.[1] || 'Unknown';
    const hasTLS = router.tls !== null && router.tls !== undefined;
    const safeId = sanitizeId(name);

    const linkScheme = hasTLS ? 'https' : 'http';

    return `
        <tr class="hover:bg-custom-hover transition-colors border-b border-custom-separator" data-host="${host}" data-name="${encodeURIComponent(name)}" data-tls="${hasTLS}">
            <!-- store host & name to dataset for polling -->
            
            <td class="px-6 py-5 whitespace-nowrap">
                <div class="text-sm font-medium text-default">${name}</div>
            </td>
            <td class="px-6 py-5 whitespace-nowrap">
                ${host !== 'Unknown' ? `
                    <a href="${linkScheme}://${host}" target="_blank" rel="noopener noreferrer" class="flex items-center text-sm text-default w-full no-underline" title="Open ${host}" aria-label="Open ${host} in new tab">
                        <span>${host}</span>
                        <span class="ml-2 text-custom-teal" style="font-size:0.95rem; margin-left:0.25rem">↗</span>
                    </a>
                ` : `
                    <div class="text-sm text-default">${host}</div>
                `}
            </td>
            <td class="px-6 py-5 whitespace-nowrap">
                <div class="text-sm text-default">${router.service}</div>
            </td>
            
            <td class="px-6 py-5 whitespace-nowrap">
                <div class="text-sm text-default">${router.entryPoints.join(', ')}</div>
            </td>
            <td class="px-6 py-5 whitespace-nowrap">
                ${hasTLS ? '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Enabled</span>' : '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">Disabled</span>'}
            </td>
            <td class="px-6 py-5 whitespace-nowrap text-right text-sm font-medium">
                <button data-router="${encodeURIComponent(name)}" class="btn-edit text-blue-600 hover:text-blue-900 mr-3 inline-flex items-center">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                    Edit
                </button>
                <button data-router="${encodeURIComponent(name)}" class="btn-delete text-red-600 hover:text-red-900 inline-flex items-center">
                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                    Delete
                </button>
            </td>
            <td class="px-6 py-5 whitespace-nowrap">
                <div id="status-badge-${safeId}" class="status-badge status-down" title="Checking...">
                    <span class="status-icon"><svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg></span>
                    <span class="status-latency">-</span>
                </div>
            </td>
        </tr>
    `;
}

// Modal functions
function showAddRouterModal() {
    currentEditingRouter = null;
    document.getElementById('modal-title').textContent = 'Add Router';
    document.getElementById('router-form').reset();
    document.getElementById('router-name').disabled = false;
    document.querySelector('[name="entrypoint"][value="websecure"]').checked = true;
    
    const modal = document.getElementById('router-modal');
    modal.classList.remove('hidden');
    modal.offsetHeight; // Trigger reflow
    modal.style.opacity = '0';
    modal.style.transition = 'opacity 300ms ease-in-out';
    requestAnimationFrame(() => {
        modal.style.opacity = '1';
    });
}

async function editRouter(name) {
    try {
        const response = await fetch(`${API_BASE}/routers/${name}`);
        const router = await response.json();
        
        currentEditingRouter = name;
        document.getElementById('modal-title').textContent = 'Edit Router';
        document.getElementById('router-name').value = name;
        document.getElementById('router-name').disabled = true;
        
        const host = router.rule.match(/Host\(`([^`]+)`\)/)?.[1] || '';
        document.getElementById('router-host').value = host;
        document.getElementById('router-service').value = router.service;
        
        // Get service URL
        const servicesResponse = await fetch(`${API_BASE}/config`);
        const config = await servicesResponse.json();
        const service = config.http.services[router.service];
        if (service && service.loadBalancer.servers.length > 0) {
            document.getElementById('service-url').value = service.loadBalancer.servers[0].url;
        }
        
        // Entry points
        document.querySelectorAll('[name="entrypoint"]').forEach(cb => {
            cb.checked = router.entryPoints.includes(cb.value);
        });
        
        // Add any custom entry points that don't exist yet
        const container = document.getElementById('entrypoints-container');
        router.entryPoints.forEach(ep => {
            if (!document.querySelector(`[name="entrypoint"][value="${ep}"]`)) {
                const label = document.createElement('label');
                label.className = 'flex items-center';
                label.innerHTML = `
                    <input type="checkbox" name="entrypoint" value="${ep}" checked class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500">
                    <span class="ml-2 text-sm text-gray-700">${ep}</span>
                    <button type="button" onclick="removeEntryPoint(this, '${ep}')" class="ml-auto text-red-600 hover:text-red-800 text-xs">Remove</button>
                `;
                container.appendChild(label);
            }
        });
        
        // TLS
        const hasTLS = router.tls !== null && router.tls !== undefined;
        document.getElementById('tls-enabled').checked = hasTLS;
        
        const modal = document.getElementById('router-modal');
        modal.classList.remove('hidden');
        modal.offsetHeight; // Trigger reflow
        modal.style.opacity = '0';
        modal.style.transition = 'opacity 300ms ease-in-out';
        requestAnimationFrame(() => {
            modal.style.opacity = '1';
        });
    } catch (error) {
        console.error('Error loading router:', error);
        showNotification('Failed to load router details', 'error');
    }
}

function closeModal() {
    const modal = document.getElementById('router-modal');
    modal.style.opacity = '0';
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.style.opacity = '';
    }, 300);
    currentEditingRouter = null;
}

// Form submission
function setupFormHandlers() {
    // Form submit
    document.getElementById('router-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveRouter();
    });
}

async function saveRouter() {
    const name = currentEditingRouter || document.getElementById('router-name').value;
    const host = document.getElementById('router-host').value;
    const serviceName = document.getElementById('router-service').value;
    const serviceUrl = document.getElementById('service-url').value;
    
    const entryPoints = Array.from(document.querySelectorAll('[name="entrypoint"]:checked'))
        .map(cb => cb.value);
    
    const tlsEnabled = document.getElementById('tls-enabled').checked;
    
    const router = {
        rule: `Host(\`${host}\`)`,
        entryPoints: entryPoints,
        service: serviceName,
        tls: tlsEnabled ? { certResolver: 'cloudflare' } : null
    };

    try {
        // Save router
        const response = await fetch(`${API_BASE}/routers/${name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(router)
        });

        if (!response.ok) throw new Error('Failed to save router');

        // Update service URL
        const config = await fetch(`${API_BASE}/config`).then(r => r.json());
        if (!config.http.services[serviceName]) {
            config.http.services[serviceName] = {
                loadBalancer: { servers: [] }
            };
        }
        config.http.services[serviceName].loadBalancer.servers = [{ url: serviceUrl }];
        
        await fetch(`${API_BASE}/config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        closeModal();
        loadRouters();
        loadEntryPoints();
        showNotification('Router saved successfully', 'success');
    } catch (error) {
        console.error('Error saving router:', error);
        showNotification('Failed to save router', 'error');
    }
}

function deleteRouter(name) {
    pendingDeleteRouter = name;
    document.getElementById('delete-router-name').textContent = name;
    
    const modal = document.getElementById('delete-modal');
    modal.classList.remove('hidden');
    modal.offsetHeight; // Trigger reflow
    modal.style.opacity = '0';
    modal.style.transition = 'opacity 300ms ease-in-out';
    requestAnimationFrame(() => {
        modal.style.opacity = '1';
    });
}

function closeDeleteModal() {
    const modal = document.getElementById('delete-modal');
    modal.style.opacity = '0';
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.style.opacity = '';
    }, 300);
    pendingDeleteRouter = null;
}

async function confirmDeleteRouter() {
    if (!pendingDeleteRouter) return;

    try {
        const response = await fetch(`${API_BASE}/routers/${pendingDeleteRouter}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete router');

        closeDeleteModal();
        loadRouters();
        loadEntryPoints();
        showNotification('Router deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting router:', error);
        showNotification('Failed to delete router', 'error');
    }
}

function addEntryPoint() {
    const input = document.getElementById('new-entrypoint-name');
    const entrypointName = input.value.trim();
    
    if (!entrypointName) {
        showNotification('Please enter an entry point name', 'error');
        return;
    }
    
    // Check if already exists
    const existing = document.querySelector(`[name="entrypoint"][value="${entrypointName}"]`);
    if (existing) {
        showNotification('Entry point already exists', 'error');
        return;
    }
    
    // Add new checkbox
    const container = document.getElementById('entrypoints-container');
    const label = document.createElement('label');
    label.className = 'flex items-center';
    label.innerHTML = `
        <input type="checkbox" name="entrypoint" value="${entrypointName}" checked class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500">
        <span class="ml-2 text-sm text-gray-700">${entrypointName}</span>
        <button type="button" onclick="removeEntryPoint(this, '${entrypointName}')" class="ml-auto text-red-600 hover:text-red-800 text-xs">Remove</button>
    `;
    container.appendChild(label);
    
    input.value = '';
    showNotification('Entry point added', 'success');
}

function removeEntryPoint(button, entrypointName) {
    if (confirm(`Remove entry point "${entrypointName}"?`)) {
        button.closest('label').remove();
        showNotification('Entry point removed', 'success');
    }
}

function showNotification(message, type) {
    // Use toast container for stacked, non-overlapping toasts
    const container = document.getElementById('toast-container') || (function(){
        const el = document.createElement('div');
        el.id = 'toast-container';
        el.className = 'toast-container';
        document.body.appendChild(el);
        return el;
    })();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type || 'info'}`;

    const msg = document.createElement('div');
    msg.className = 'toast-message';
    msg.textContent = message;

    const close = document.createElement('button');
    close.className = 'toast-close';
    close.setAttribute('aria-label', 'Close notification');
    close.innerHTML = '✕';
    close.onclick = () => {
        hideToast(toast);
    };

    toast.appendChild(msg);
    toast.appendChild(close);
    // Insert at top so newest appears first
    container.insertBefore(toast, container.firstChild);

    // Allow entrance animation
    requestAnimationFrame(() => toast.classList.add('show'));

    // Auto dismiss after 3s
    const timeout = setTimeout(() => hideToast(toast), 3000);

    function hideToast(node){
        if (!node) return;
        node.classList.remove('show');
        // Wait for transition then remove
        setTimeout(() => {
            if (node.parentNode) node.parentNode.removeChild(node);
        }, 260);
        clearTimeout(timeout);
    }
}
