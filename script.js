document.addEventListener('DOMContentLoaded', () => {

    // =========================================================================
    // 1. SÉLECTEURS ET NAVIGATION
    // =========================================================================

    const modules = {
        'firewall': document.getElementById('module-firewall'),
        'traffic': document.getElementById('module-traffic'),
        'scan': document.getElementById('module-scan'),
        'library': document.getElementById('module-library'),
        'favorites': document.getElementById('module-favorites'),
        'subnet': document.getElementById('module-subnet')
    };

    const statusText = document.getElementById('status-text');

    // Mise à jour du style du menu (Carré Blanc)
    function updateSidebarStyle(activeModuleId) {
        const allLinks = document.querySelectorAll('[data-module]');
        allLinks.forEach(link => {
            const modName = link.getAttribute('data-module');
            const icon = link.querySelector('iconify-icon');

            // Reset (Inactif)
            link.className = 'flex items-center gap-2.5 px-2 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60 rounded transition-all cursor-pointer';
            if (icon) icon.className = "text-zinc-400 transition-colors";

            // Actif
            if (modName === activeModuleId) {
                link.className = 'flex items-center gap-2.5 px-2 py-1.5 text-sm text-white bg-zinc-800 rounded border border-zinc-700 shadow-sm transition-all cursor-default';
                if (icon) icon.className = "text-accent-500";
            }
        });
    }

    // Afficher un module
    function showModule(modKey) {
        // Cacher tous les modules
        Object.values(modules).forEach(el => {
            if (el) el.classList.add('hidden');
        });

        // Afficher le bon
        const activeEl = modules[modKey];
        if (activeEl) {
            activeEl.classList.remove('hidden');
        } else {
            if (modules['firewall']) modules['firewall'].classList.remove('hidden');
        }

        updateSidebarStyle(modKey);
        if (statusText) statusText.textContent = `Module actif : ${modKey.charAt(0).toUpperCase() + modKey.slice(1)}`;
        
        // Si on va dans la bibliothèque, on lance une recherche par défaut pour afficher quelque chose
        if(modKey === 'library') {
            triggerCmdSearch();
        }
    }

    document.querySelectorAll('[data-module]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const mod = link.getAttribute('data-module');
            showModule(mod);
        });
    });

    // =========================================================================
    // 2. BIBLIOTHÈQUE DE COMMANDES (CORRIGÉ : RECHERCHE MANUELLE UNIQUEMENT)
    // =========================================================================

    const cmdlibOsHidden = document.getElementById('cmdlib-os');
    const cmdlibOsButtons = document.querySelectorAll('.cmdlib-os');
    const cmdlibSearchBtn = document.getElementById('cmdlib-search');
    const cmdlibQueryInput = document.getElementById('cmdlib-query');
    const cmdlibResults = document.getElementById('cmdlib-results');

    // DONNÉES DE LA BIBLIOTHÈQUE
    const commandLibrary = [
        {
            id: 'huawei-switch-basic',
            keywords: ['huawei', 'switch', 'configurer', 'vlan'],
            title: 'Configuration basique switch Huawei',
            os: 'network',
            steps: [
                { cmd: 'system-view', desc: 'Mode config' },
                { cmd: 'vlan 10', desc: 'Créer VLAN 10' },
                { cmd: 'interface G0/0/1', desc: 'Aller dans l\'interface' },
                { cmd: 'port link-type access', desc: 'Mode access' },
                { cmd: 'port default vlan 10', desc: 'Assigner VLAN' }
            ]
        },
        {
            id: 'ip-config',
            keywords: ['ip', 'adresse', 'configurer', 'reseau'],
            title: 'Voir l\'adresse IP',
            os: 'multi',
            perOs: {
                windows: [{ cmd: 'ipconfig /all', desc: 'Détails complets des cartes réseau.' }],
                macos: [{ cmd: 'ifconfig', desc: 'Lister les interfaces.' }, { cmd: 'ipconfig getifaddr en0', desc: 'IP de l\'interface Wi-Fi.' }],
                linux: [{ cmd: 'ip addr show', desc: 'Voir les adresses IP.' }]
            }
        },
        {
            id: 'install-package',
            keywords: ['installer', 'install', 'programme', 'logiciel', 'gedit', 'git', 'vlc'],
            title: 'Installer un logiciel',
            os: 'multi',
            perOs: {
                windows: [{ cmd: 'winget install <nom>', desc: 'Via Winget.' }],
                macos: [{ cmd: 'brew install <nom>', desc: 'Via Homebrew.' }],
                linux: [{ cmd: 'sudo apt install <nom>', desc: 'Debian/Ubuntu' }]
            }
        },
        {
            id: 'flush-dns',
            keywords: ['dns', 'cache', 'vider', 'flush'],
            title: 'Vider le cache DNS',
            os: 'multi',
            perOs: {
                windows: [{ cmd: 'ipconfig /flushdns', desc: 'Vider le cache.' }],
                macos: [{ cmd: 'sudo killall -HUP mDNSResponder', desc: 'macOS récent.' }],
                linux: [{ cmd: 'sudo systemd-resolve --flush-caches', desc: 'Systemd.' }]
            }
        },
        {
            id: 'check-disk',
            keywords: ['disque', 'espace', 'stockage'],
            title: 'Vérifier l\'espace disque',
            os: 'multi',
            perOs: {
                windows: [{ cmd: 'wmic logicaldisk get size,freespace,caption', desc: 'Via WMIC.' }],
                macos: [{ cmd: 'df -h', desc: 'Format lisible.' }],
                linux: [{ cmd: 'df -h', desc: 'Format lisible.' }]
            }
        },
        {
            id: 'ping-test',
            keywords: ['ping', 'test', 'connexion'],
            title: 'Tester la connexion (Ping)',
            os: 'multi',
            perOs: {
                windows: [{ cmd: 'ping google.com', desc: '4 paquets par défaut.' }],
                macos: [{ cmd: 'ping -c 4 google.com', desc: 'Limiter à 4 paquets.' }],
                linux: [{ cmd: 'ping -c 4 google.com', desc: 'Limiter à 4 paquets.' }]
            }
        }
    ];

    // GESTION DES BOUTONS OS (Windows / Mac / Linux)
    if (cmdlibOsButtons) {
        cmdlibOsButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const os = btn.getAttribute('data-os') || 'windows';
                if(cmdlibOsHidden) cmdlibOsHidden.value = os;

                // Mise à jour visuelle des boutons
                cmdlibOsButtons.forEach(b => {
                    b.classList.remove('bg-accent-600', 'text-white');
                    b.classList.add('text-zinc-300', 'hover:bg-zinc-800');
                });
                btn.classList.remove('text-zinc-300', 'hover:bg-zinc-800');
                btn.classList.add('bg-accent-600', 'text-white');
                
                // Si une recherche est DÉJÀ affichée, on la met à jour pour le nouvel OS
                // Si la barre est vide, on ne fait rien.
                if (cmdlibQueryInput && cmdlibQueryInput.value.trim() !== '') {
                    triggerCmdSearch();
                }
            });
        });
    }

    // FONCTION DE RECHERCHE
    function searchCommandLibrary(query, os) {
        const q = (query || '').toLowerCase().trim();
        
        // MODIFICATION ICI : Si la recherche est vide, on renvoie une liste vide
        if (!q) return []; 
        
        const words = q.split(/\s+/).filter(Boolean);
        return commandLibrary.filter(item => {
            const allKeywords = item.keywords.join(' ').toLowerCase() + ' ' + item.title.toLowerCase();
            return words.some(w => allKeywords.includes(w));
        });
    }

    // FONCTION D'AFFICHAGE
    function renderCommandResults(items, os, container) {
        if (!container) return;
        container.innerHTML = '';

        // Si aucun item n'est renvoyé (soit recherche vide, soit rien trouvé)
        if (!items || items.length === 0) {
            // On vérifie si c'est parce que la barre est vide ou parce qu'on a rien trouvé
            const query = cmdlibQueryInput.value.trim();
            if (query === "") {
                container.innerHTML = '<p class="text-zinc-500 italic">Entrez un mot-clé (ex: "installer", "dns") et validez.</p>';
            } else {
                container.innerHTML = '<p class="text-zinc-500 italic">Aucun résultat trouvé pour "' + query + '".</p>';
            }
            return;
        }

        let html = '';
        items.forEach(item => {
            html += '<div class="border border-zinc-800 rounded-lg p-3 space-y-2 bg-zinc-950/60 hover:border-zinc-700 transition-colors">';
            html += `<div class="flex items-center justify-between"><div class="text-xs font-semibold text-zinc-100">${item.title}</div><div class="text-[10px] text-zinc-600 border border-zinc-800 px-1 rounded uppercase">${item.os === 'multi' ? os : 'CLI'}</div></div>`;

            if (item.os === 'network') {
                item.steps.forEach(step => {
                    const uniqueId = 'cmd-' + Math.random().toString(36).substr(2, 9);
                    html += `<div class="group relative"><pre id="${uniqueId}" class="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-[11px] text-zinc-100 overflow-x-auto font-mono cursor-pointer hover:bg-zinc-800 transition-colors" onclick="copyTextFromElement('${uniqueId}')">${step.cmd}</pre></div>`;
                    html += `<p class="text-[10px] text-zinc-500 mb-1 ml-1">${step.desc}</p>`;
                });
            } else if (item.os === 'multi' && item.perOs) {
                const perOsSteps = item.perOs[os];
                if (!perOsSteps || perOsSteps.length === 0) {
                    html += '<p class="text-[11px] text-zinc-500 italic">Aucune commande spécifique pour cet OS.</p>';
                } else {
                    perOsSteps.forEach(step => {
                        const uniqueId = 'cmd-' + Math.random().toString(36).substr(2, 9);
                        html += `<div class="group relative">
                                    <pre id="${uniqueId}" class="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-[11px] text-zinc-100 overflow-x-auto font-mono cursor-pointer hover:bg-zinc-800 transition-colors" onclick="copyTextFromElement('${uniqueId}')">${step.cmd}</pre>
                                 </div>`;
                        html += `<p class="text-[10px] text-zinc-500 mb-2 ml-1">${step.desc}</p>`;
                    });
                }
            }
            html += '</div>';
        });
        container.innerHTML = html;
    }

    // DÉCLENCHEUR
    function triggerCmdSearch() {
        if (!cmdlibQueryInput || !cmdlibOsHidden) return;
        const query = cmdlibQueryInput.value;
        const os = cmdlibOsHidden.value || 'windows';
        const items = searchCommandLibrary(query, os);
        renderCommandResults(items, os, cmdlibResults);
    }

    // ÉCOUTEURS : UNIQUEMENT CLIC ET ENTRÉE
    if (cmdlibSearchBtn) cmdlibSearchBtn.addEventListener('click', triggerCmdSearch);
    
    if (cmdlibQueryInput) {
        cmdlibQueryInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                triggerCmdSearch();
            }
        });
        // J'ai supprimé l'écouteur "input" qui lançait la recherche à chaque lettre tapée.
    }
    
    // Initialisation : On affiche le message d'attente
    if (cmdlibResults) {
        cmdlibResults.innerHTML = '<p class="text-zinc-500 italic">Sélectionnez un système et tapez une recherche...</p>';
    }


    // =========================================================================
    // 3. MODULE PARE-FEU (IPTABLES)
    // =========================================================================

    const chainSelect = document.getElementById('chain-select');
    const protocolSelect = document.getElementById('protocol-select');
    const ipTypeSelect = document.getElementById('input-ip-type');
    const sourceInput = document.getElementById('source-input');
    const ifaceInput = document.getElementById('iface-input');
    const invIfaceCheckbox = document.getElementById('inv-iface');
    const portsInput = document.getElementById('input-ports');
    const logInput = document.getElementById('input-log');
    const limitInput = document.getElementById('input-limit');
    const stateCheckboxes = document.querySelectorAll('input[data-state]');

    function updateFirewallCommand() {
        if (!chainSelect) return;
        
        const chain = chainSelect.value;
        const protocol = protocolSelect.value;
        const ip = sourceInput.value;
        const iface = ifaceInput.value;
        const ports = portsInput.value;
        const action = document.getElementById('input-action') ? document.getElementById('input-action').value : 'ACCEPT';

        let html = `<div class="text-zinc-500 select-none mb-2"># Généré par NetCmd Pro</div>`;
        html += `<div class="group relative leading-7"><span class="text-purple-400">iptables</span> <span class="text-zinc-300">-A ${chain}</span>`;
        if (iface) html += ` <span class="text-zinc-300">-i ${iface}</span>`;
        if (ip) html += ` <span class="text-zinc-300">-s <span class="text-blue-300">${ip}</span></span>`;
        html += ` <span class="text-zinc-300">-p ${protocol}</span>`;
        if (ports) html += ` <span class="text-zinc-300">--dports <span class="text-amber-300">${ports}</span></span>`;
        
        const actionColor = action === 'ACCEPT' ? 'text-emerald-400' : 'text-red-400';
        html += ` <span class="text-zinc-300">-j </span><span class="${actionColor}">${action}</span></div>`;

        const codeOutput = document.getElementById('code-output');
        if (codeOutput && !modules['firewall'].classList.contains('hidden')) {
            codeOutput.innerHTML = html;
        }
    }

    window.setAction = function(action) {
        const hidden = document.getElementById('input-action');
        if(hidden) hidden.value = action;
        
        const btnAccept = document.getElementById('btn-accept');
        const btnDrop = document.querySelector('[data-action-value="DROP"]');
        
        if(btnAccept && btnDrop) {
            if(action === 'ACCEPT') {
                btnAccept.classList.add('bg-emerald-500/10', 'text-emerald-400', 'border-emerald-500/20');
                btnAccept.classList.remove('text-zinc-500');
                btnDrop.classList.remove('bg-red-500/10', 'text-red-400', 'border-red-500/20');
                btnDrop.classList.add('text-zinc-500');
            } else {
                btnDrop.classList.add('bg-red-500/10', 'text-red-400', 'border-red-500/20');
                btnDrop.classList.remove('text-zinc-500');
                btnAccept.classList.remove('bg-emerald-500/10', 'text-emerald-400', 'border-emerald-500/20');
                btnAccept.classList.add('text-zinc-500');
            }
        }
        updateFirewallCommand();
    };

    if (chainSelect) {
        [chainSelect, protocolSelect, sourceInput, ifaceInput, portsInput].forEach(el => {
            if (el) el.addEventListener('input', updateFirewallCommand);
        });
    }

    // =========================================================================
    // 4. MODULES TRAFIC (TCPDUMP) & SCAN (NMAP)
    // =========================================================================

    const trafficBuildBtn = document.getElementById('traffic-build');
    if (trafficBuildBtn) {
        trafficBuildBtn.addEventListener('click', () => {
            const iface = document.getElementById('traffic-iface').value || 'eth0';
            const filter = document.getElementById('traffic-filter').value || '';
            const out = document.getElementById('traffic-output');
            if (out) out.textContent = `tcpdump -i ${iface} ${filter}`;
        });
    }

    const scanBuildBtn = document.getElementById('scan-build');
    if (scanBuildBtn) {
        scanBuildBtn.addEventListener('click', () => {
            const target = document.getElementById('scan-target').value || '127.0.0.1';
            const ports = document.getElementById('scan-ports').value;
            const out = document.getElementById('scan-output');
            let cmd = 'nmap';
            if (ports) cmd += ` -p ${ports}`;
            cmd += ` ${target}`;
            if (out) out.textContent = cmd;
        });
    }


   // =========================================================================
    // 5. LOGIQUE DU CALCULATEUR IP
    // =========================================================================

    // Utilitaires de conversion
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

    const btnCalcSubnet = document.getElementById('btn-calc-subnet');
    
    if (btnCalcSubnet) {
        btnCalcSubnet.addEventListener('click', (e) => {
            e.preventDefault(); // Empêche le rechargement
            
            // Récupération des valeurs
            const ipVal = document.getElementById('subnet-ip').value || '192.168.1.1';
            const cidr = parseInt(document.getElementById('subnet-mask').value);
            const results = document.getElementById('subnet-results');

            // Calculs binaires
            const ipInt = ipToInt(ipVal);
            const maskInt = (0xFFFFFFFF << (32 - cidr)) >>> 0;
            const invMaskInt = (~maskInt) >>> 0;
            const netInt = (ipInt & maskInt) >>> 0;
            const broadcastInt = (netInt | invMaskInt) >>> 0;

            // Calculs des hôtes
            let firstHost, lastHost, count;
            // Gestion des cas spéciaux /31 et /32
            if (cidr >= 31) {
                 firstHost = netInt; 
                 lastHost = broadcastInt; 
                 count = 0;
            } else {
                 firstHost = netInt + 1; 
                 lastHost = broadcastInt - 1; 
                 count = (broadcastInt - netInt - 1);
            }

            // Préparation des données pour l'affichage
            const firstOctet = parseInt(ipVal.split('.')[0]);
            const ipClass = getIpClass(firstOctet);
            
            // Génération des chaînes binaires pour le visuel
            const binStr = ipInt.toString(2).padStart(32, '0');
            // On ajoute un espace tous les 8 bits pour la lisibilité
            const prettyBin = binStr.match(/.{1,8}/g).join('<span class="mx-1 text-zinc-600">.</span>');
            
            // Séparation couleur Réseau vs Hôte
            const netBin = binStr.substring(0, cidr);
            const hostBin = binStr.substring(cidr);

            // INJECTION DU HTML DE RÉSULTAT
            results.innerHTML = `
                <div class="w-full h-full flex flex-col text-left animate-in fade-in duration-500">
                    
                    <div class="grid grid-cols-2 gap-6 mb-8">
                        <div class="bg-zinc-900/40 p-4 rounded-lg border border-zinc-800">
                            <div class="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1">Adresse Réseau</div>
                            <div class="text-xl font-mono text-emerald-400">${intToIp(netInt)}</div>
                            <div class="text-xs text-zinc-600 mt-1">${ipClass}</div>
                        </div>
                        <div class="bg-zinc-900/40 p-4 rounded-lg border border-zinc-800">
                            <div class="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1">Broadcast</div>
                            <div class="text-xl font-mono text-purple-400">${intToIp(broadcastInt)}</div>
                            <div class="text-xs text-zinc-600 mt-1">Dernière adresse</div>
                        </div>
                    </div>

                    <div class="space-y-4 mb-8">
                        <div class="flex justify-between items-center border-b border-zinc-800/60 pb-2">
                            <span class="text-zinc-400 text-sm">Premier hôte utilisable</span>
                            <span class="text-zinc-200 font-mono text-sm">${intToIp(firstHost)}</span>
                        </div>
                        <div class="flex justify-between items-center border-b border-zinc-800/60 pb-2">
                            <span class="text-zinc-400 text-sm">Dernier hôte utilisable</span>
                            <span class="text-zinc-200 font-mono text-sm">${intToIp(lastHost)}</span>
                        </div>
                        <div class="flex justify-between items-center border-b border-zinc-800/60 pb-2">
                            <span class="text-zinc-400 text-sm">Masque de sous-réseau</span>
                            <span class="text-zinc-200 font-mono text-sm">${intToIp(maskInt)}</span>
                        </div>
                        <div class="flex justify-between items-center border-b border-zinc-800/60 pb-2">
                            <span class="text-zinc-400 text-sm">Nombre d'hôtes max</span>
                            <span class="text-white bg-accent-600/20 text-accent-400 px-2 py-0.5 rounded text-xs font-bold">${count.toLocaleString()}</span>
                        </div>
                    </div>

                    <div class="mt-auto bg-black/20 rounded-lg p-4 border border-zinc-800">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-[10px] text-zinc-500 uppercase font-bold">Visualisation Binaire</span>
                            <span class="text-[10px] text-zinc-600">/${cidr}</span>
                        </div>
                        <div class="font-mono text-xs break-all tracking-wider leading-relaxed">
                            <span class="text-accent-400 border-b-2 border-accent-500/50 pb-0.5" title="Partie Réseau">${netBin}</span><span class="text-zinc-500 border-b-2 border-zinc-700/50 pb-0.5" title="Partie Hôte">${hostBin}</span>
                        </div>
                        <div class="flex gap-4 mt-3 text-[10px]">
                            <div class="flex items-center gap-1.5">
                                <div class="w-2 h-2 rounded-full bg-accent-500"></div>
                                <span class="text-zinc-400">Bits Réseau</span>
                            </div>
                            <div class="flex items-center gap-1.5">
                                <div class="w-2 h-2 rounded-full bg-zinc-600"></div>
                                <span class="text-zinc-400">Bits Hôte</span>
                            </div>
                        </div>
                    </div>

                </div>
            `;
        });
    }

    // =========================================================================
    // 6. UTILITAIRES (COPIE & TOAST)
    // =========================================================================

    let toastTimeout;
    function showToast(message) {
        let toast = document.getElementById('toast-notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast-notification';
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message || "Copié !";
        toast.classList.add('show');
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Fonction globale pour copier du texte depuis un ID
    window.copyTextFromElement = function(elementId) {
        const el = document.getElementById(elementId);
        if(!el) return;
        const text = el.innerText || el.textContent;
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => showToast("Commande copiée !"));
        } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast("Commande copiée !");
        }
    };
    
    // Alias pour la fonction générée par les anciens modules
    window.copyOutput = function(id) { window.copyTextFromElement(id); };

    // =========================================================================
    // 7. INITIALISATION
    // =========================================================================
    showModule('firewall');
    updateFirewallCommand();
});