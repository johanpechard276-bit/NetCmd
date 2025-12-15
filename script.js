document.addEventListener('DOMContentLoaded', () => {
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
    const statusText = document.getElementById('status-text');
    const moduleFirewall = document.getElementById('module-firewall');
    const moduleTraffic = document.getElementById('module-traffic');
    const moduleScan = document.getElementById('module-scan');
    const moduleLibrary = document.getElementById('module-library');
    const moduleFavorites = document.getElementById('module-favorites');

    function getAction() {
        const hidden = document.getElementById('input-action');
        return hidden ? hidden.value || 'ACCEPT' : 'ACCEPT';
    }

    function setAction(action) {
        const hidden = document.getElementById('input-action');
        const btnAccept = document.getElementById('btn-accept');
        const btnDrop = document.querySelector('[data-action-value="DROP"]');

        if (hidden) hidden.value = action;

        if (btnAccept && btnDrop) {
            if (action === 'ACCEPT') {
                btnAccept.classList.add('action-active');
                btnAccept.classList.remove('drop-active', 'action-inactive');
                btnDrop.classList.add('action-inactive');
                btnDrop.classList.remove('drop-active', 'action-active');
            } else {
                btnDrop.classList.add('drop-active');
                btnDrop.classList.remove('action-inactive');
                btnAccept.classList.add('action-inactive');
                btnAccept.classList.remove('action-active');
            }
        }

        updateCommand();
    }

    window.setAction = setAction;

    function collectStates() {
        const states = [];
        stateCheckboxes.forEach(cb => {
            if (cb.checked && cb.dataset.state) {
                const value = cb.dataset.state === 'ESTAB' ? 'ESTABLISHED' : cb.dataset.state;
                states.push(value);
            }
        });
        return states;
    }

    function updateVisualizer(iface, ports, protocol, action, ip) {
        const ifaceLabel = document.getElementById('vis-iface');
        const portsLabel = document.getElementById('vis-ports');
        const sourceText = document.getElementById('vis-source-text');
        const box = document.getElementById('vis-action-box');
        const icon = document.getElementById('vis-action-icon');
        const text = document.getElementById('vis-action-text');

        if (ifaceLabel) ifaceLabel.innerText = iface ? `Interface ${iface}` : 'Toutes Interfaces';

        if (portsLabel) {
            let portText = protocol ? protocol.toUpperCase() : 'ANY';
            if (ports) portText += `: ${ports}`;
            portsLabel.innerText = portText;
        }

        if (sourceText) sourceText.innerText = ip || 'N/A';

        if (box && icon && text) {
            if (action === 'DROP') {
                box.className = 'w-10 h-10 rounded-lg bg-red-900/20 border border-red-500/50 flex items-center justify-center text-red-500 transition-colors duration-300';
                icon.setAttribute('icon', 'lucide:ban');
                text.className = 'text-[10px] font-mono text-red-500 transition-colors duration-300';
                text.innerText = 'DROP';
            } else {
                box.className = 'w-10 h-10 rounded-lg bg-emerald-900/20 border border-emerald-500/50 flex items-center justify-center text-emerald-500 transition-colors duration-300';
                icon.setAttribute('icon', 'lucide:check-circle');
                text.className = 'text-[10px] font-mono text-emerald-500 transition-colors duration-300';
                text.innerText = 'ACCEPT';
            }
        }
    }

    function updateCommand() {
        const chain = chainSelect ? chainSelect.value : 'INPUT';
        const protocol = protocolSelect ? protocolSelect.value : 'tcp';
        const ip = sourceInput ? sourceInput.value : '';
        const ipType = ipTypeSelect ? ipTypeSelect.value : 'src';
        const iface = ifaceInput ? ifaceInput.value : '';
        const invIface = invIfaceCheckbox ? invIfaceCheckbox.checked : false;
        const ports = portsInput ? portsInput.value : '';
        const logPrefix = logInput ? logInput.value : '';
        const rateLimit = limitInput ? limitInput.value : '';
        const action = getAction();
        const states = collectStates();

        let html = `<div class="text-zinc-500 select-none mb-2"># Généré par NetCmd Pro</div>`;
        html += `<div class="text-zinc-500 select-none mb-4"># Règle ${chain} pour ${protocol.toUpperCase()}</div>`;

        html += `<div class="group relative leading-7">`;
        html += `<span class="text-purple-400">iptables</span>`;
        html += `<span class="text-zinc-300"> -A ${chain}</span>`;

        if (iface) {
            html += `<br><span class="text-zinc-300 pl-4">${invIface ? '!' : ''}-i ${iface}</span>`;
        }

        if (ip) {
            const flag = ipType === 'src' ? '-s' : '-d';
            html += `<br><span class="text-zinc-300 pl-4">${flag} <span class="text-blue-300">${ip}</span></span>`;
        }

        html += `<br><span class="text-zinc-300 pl-4">-p ${protocol}</span>`;

        if (ports && (protocol === 'tcp' || protocol === 'udp')) {
            html += `<br><span class="text-zinc-300 pl-4">-m multiport --dports </span><span class="text-amber-300">${ports}</span>`;
        }

        if (states.length > 0) {
            html += `<br><span class="text-zinc-300 pl-4">-m state --state </span><span class="text-blue-300">${states.join(',')}</span>`;
        }

        if (rateLimit) {
            html += `<br><span class="text-zinc-300 pl-4">-m limit --limit ${rateLimit}/min</span>`;
        }

        if (logPrefix) {
            html += `<br><span class="text-zinc-500 pl-4"># Note: le logging nécessite une règle LOG séparée</span>`;
        }

        const actionColor = action === 'ACCEPT' ? 'text-emerald-400' : 'text-red-400';
        html += `<br><span class="text-zinc-300 pl-4">-j </span><span class="${actionColor}">${action}</span>`;
        html += `</div>`;

        const codeOutput = document.getElementById('code-output');
        if (codeOutput) {
            codeOutput.innerHTML = html;
        }

        updateVisualizer(iface, ports, protocol, action, ip);
    }

    window.updateCommand = updateCommand;

    function resetForm() {
        if (chainSelect) chainSelect.value = 'INPUT';
        if (protocolSelect) protocolSelect.value = 'tcp';
        if (sourceInput) sourceInput.value = '';
        if (ifaceInput) ifaceInput.value = 'eth0';
        if (invIfaceCheckbox) invIfaceCheckbox.checked = false;
        if (portsInput) portsInput.value = '80,443';
        if (logInput) logInput.value = '';
        if (limitInput) limitInput.value = '';

        stateCheckboxes.forEach(cb => {
            if (cb.dataset.state === 'NEW' || cb.dataset.state === 'ESTABLISHED' || cb.dataset.state === 'ESTAB') {
                cb.checked = true;
            } else {
                cb.checked = false;
            }
        });

        setAction('ACCEPT');
        updateCommand();
    }

    window.resetForm = resetForm;

    function setPort(port) {
        if (!portsInput) return;
        if (portsInput.value === '') portsInput.value = port;
        else if (!portsInput.value.split(',').includes(port)) portsInput.value += ',' + port;
        updateCommand();
    }

    window.setPort = setPort;

    // Boutons sidebar / recherche
    const searchBtn = document.getElementById('search-button');
    if (searchBtn && statusText) {
        searchBtn.addEventListener('click', () => {
            const q = prompt('Recherche de commandes :');
            if (q && q.trim() !== '') {
                statusText.textContent = `Recherche: ${q}`;
            }
        });
    }

    function showModule(mod) {
        if (moduleFirewall) moduleFirewall.classList.add('hidden');
        if (moduleTraffic) moduleTraffic.classList.add('hidden');
        if (moduleScan) moduleScan.classList.add('hidden');
        if (moduleLibrary) moduleLibrary.classList.add('hidden');
        if (moduleFavorites) moduleFavorites.classList.add('hidden');

        switch (mod) {
            case 'traffic':
                if (moduleTraffic) moduleTraffic.classList.remove('hidden');
                break;
            case 'scan':
                if (moduleScan) moduleScan.classList.remove('hidden');
                break;
            case 'library':
                if (moduleLibrary) moduleLibrary.classList.remove('hidden');
                break;
            case 'favorites':
                if (moduleFavorites) moduleFavorites.classList.remove('hidden');
                break;
            case 'firewall':
            default:
                if (moduleFirewall) moduleFirewall.classList.remove('hidden');
        }
    }

    document.querySelectorAll('[data-module]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const mod = link.getAttribute('data-module');
            if (!statusText) return;

            showModule(mod || 'firewall');

            switch (mod) {
                case 'firewall':
                    statusText.textContent = 'Module Pare-feu actif';
                    break;
                case 'traffic':
                    statusText.textContent = 'Module Trafic réseaux (tcpdump)';
                    break;
                case 'scan':
                    statusText.textContent = 'Module Scan (nmap)';
                    break;
                case 'library':
                    statusText.textContent = 'Bibliothèque de commandes';
                    break;
                case 'favorites':
                    statusText.textContent = 'Favoris';
                    break;
                case 'project-alpha':
                    statusText.textContent = 'Chargement de Project Alpha';
                    break;
                case 'web-servers':
                    statusText.textContent = 'Liste des serveurs Web';
                    break;
                default:
                    statusText.textContent = 'Module sélectionné';
            }
        });
    });

    // Bibliothèque de commandes
    const cmdlibOsHidden = document.getElementById('cmdlib-os');
    const cmdlibOsButtons = document.querySelectorAll('.cmdlib-os');
    const cmdlibSearchBtn = document.getElementById('cmdlib-search');
    const cmdlibQueryInput = document.getElementById('cmdlib-query');
    const cmdlibResults = document.getElementById('cmdlib-results');
    const favResults = document.getElementById('fav-results');

    const favOsHidden = document.getElementById('fav-os');
    const favOsButtons = document.querySelectorAll('.fav-os');

    if (cmdlibOsButtons && cmdlibOsHidden) {
        cmdlibOsButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const os = btn.getAttribute('data-os') || 'windows';
                cmdlibOsHidden.value = os;
                cmdlibOsButtons.forEach(b => b.classList.remove('bg-accent-600', 'text-white'));
                btn.classList.add('bg-accent-600', 'text-white');
            });
        });
    }

    const commandLibrary = [
        {
            id: 'huawei-switch-basic',
            keywords: ['huawei', 'switch', 'configurer', 'configuration', 'vlan', 'bases'],
            title: 'Configuration basique d\'un switch Huawei',
            os: 'network',
            steps: [
                { cmd: '# Pré-requis', desc: 'Branchez un câble console (ou SSH) entre votre PC et le switch, puis connectez-vous au CLI (par exemple via PuTTY ou une console série). Identifiez au minimum un port d\'accès utilisateur et un port de liaison vers le réseau (uplink).' },
                { cmd: 'system-view', desc: 'Passer en mode configuration globale du switch Huawei.' },
                { cmd: 'sysname SW-HUAWEI-01', desc: 'Définir le nom du switch pour l\'identifier facilement dans le réseau.' },
                { cmd: 'vlan 10', desc: 'Créer le VLAN 10 qui servira pour les postes utilisateurs.' },
                { cmd: 'quit', desc: 'Revenir au mode précédent.' },
                { cmd: 'interface GigabitEthernet 0/0/1', desc: 'Entrer dans l\'interface d\'accès où seront connectés les postes (par exemple G0/0/1).' },
                { cmd: 'port link-type access', desc: 'Mettre l\'interface en mode access (un seul VLAN de données).' },
                { cmd: 'port default vlan 10', desc: 'Assigner l\'interface au VLAN 10.' },
                { cmd: 'quit', desc: 'Quitter le mode interface.' },
                { cmd: 'save', desc: 'Sauvegarder la configuration dans la NVRAM pour qu\'elle persiste après redémarrage.' }
            ]
        },
        {
            id: 'install-gedit',
            keywords: ['gedit', 'installer', 'editeur'],
            title: 'Installer l\'éditeur de texte gedit',
            os: 'multi',
            perOs: {
                windows: [
                    { cmd: 'winget install gnome.gedit', desc: 'Installer gedit via le gestionnaire de paquets winget (Windows 10/11).' }
                ],
                macos: [
                    { cmd: 'brew install --cask gedit', desc: 'Installer gedit via Homebrew Cask.' }
                ],
                linux: [
                    { cmd: 'sudo apt update && sudo apt install -y gedit', desc: 'Installer gedit sur une distribution basée sur Debian/Ubuntu.' }
                ]
            }
        },
        {
            id: 'install-vscode',
            keywords: ['vscode', 'visual studio code', 'ide', 'editeur'],
            title: 'Installer Visual Studio Code',
            os: 'multi',
            perOs: {
                windows: [
                    { cmd: 'winget install Microsoft.VisualStudioCode', desc: 'Installer VS Code via winget.' }
                ],
                macos: [
                    { cmd: 'brew install --cask visual-studio-code', desc: 'Installer VS Code via Homebrew.' }
                ],
                linux: [
                    { cmd: 'sudo snap install code --classic', desc: 'Installer VS Code via snap (Ubuntu et dérivés).' }
                ]
            }
        },
        {
            id: 'install-docker',
            keywords: ['docker', 'installer', 'conteneurs'],
            title: 'Installer Docker (environnement de conteneurs)',
            os: 'multi',
            perOs: {
                windows: [
                    { cmd: 'winget install Docker.DockerDesktop', desc: 'Installer Docker Desktop via winget (Windows 10/11).' }
                ],
                macos: [
                    { cmd: 'brew install --cask docker', desc: 'Installer Docker Desktop via Homebrew.' }
                ],
                linux: [
                    { cmd: 'curl -fsSL https://get.docker.com | sh', desc: 'Installer Docker Engine via le script officiel (vérifiez la doc officielle avant en prod).' }
                ]
            }
        },
        {
            id: 'git-install',
            keywords: ['git', 'installer', 'gestion de versions'],
            title: 'Installer Git (gestionnaire de versions)',
            os: 'multi',
            perOs: {
                windows: [
                    { cmd: 'winget install Git.Git', desc: 'Installer Git via winget.' }
                ],
                macos: [
                    { cmd: 'brew install git', desc: 'Installer Git via Homebrew.' }
                ],
                linux: [
                    { cmd: 'sudo apt update && sudo apt install -y git', desc: 'Installer Git sur une distribution basée sur Debian/Ubuntu.' }
                ]
            }
        },
        {
            id: 'create-user',
            keywords: ['utilisateur', 'user', 'creer', 'ajouter'],
            title: 'Créer un nouvel utilisateur local',
            os: 'multi',
            perOs: {
                windows: [
                    { cmd: 'net user nouvelutilisateur MotDePasseFort! /add', desc: 'Créer un utilisateur local avec le mot de passe spécifié.' },
                    { cmd: 'net localgroup Administrators nouvelutilisateur /add', desc: 'Ajouter l\'utilisateur au groupe Administrators (optionnel).' }
                ],
                macos: [
                    { cmd: 'sudo sysadminctl -addUser nouvelutilisateur -admin', desc: 'Créer un nouvel utilisateur administrateur sur macOS.' }
                ],
                linux: [
                    { cmd: 'sudo adduser nouvelutilisateur', desc: 'Créer un nouvel utilisateur sur une distribution Linux.' },
                    { cmd: 'sudo usermod -aG sudo nouvelutilisateur', desc: 'Donner des droits sudo à l\'utilisateur (si groupe sudo existe).' }
                ]
            }
        },
        {
            id: 'ping-tests',
            keywords: ['ping', 'connectivite', 'reseau', 'test'],
            title: 'Tester la connectivité réseau de base',
            os: 'multi',
            perOs: {
                windows: [
                    { cmd: 'ping 8.8.8.8', desc: 'Tester la connectivité IP vers un DNS public Google.' },
                    { cmd: 'ping www.google.com', desc: 'Tester à la fois la résolution DNS et la connectivité.' }
                ],
                macos: [
                    { cmd: 'ping -c 4 8.8.8.8', desc: 'Tester la connectivité IP vers un DNS public Google (4 requêtes).' },
                    { cmd: 'ping -c 4 www.google.com', desc: 'Tester la résolution DNS et la connectivité.' }
                ],
                linux: [
                    { cmd: 'ping -c 4 8.8.8.8', desc: 'Tester la connectivité IP vers un DNS public Google (4 requêtes).' },
                    { cmd: 'ping -c 4 www.google.com', desc: 'Tester la résolution DNS et la connectivité.' }
                ]
            }
        },
        {
            id: 'git-github-push',
            keywords: ['git', 'github', 'push', 'repository', 'remote', 'commit'],
            title: 'Initialiser un dépôt Git et pousser sur GitHub (A à Z)',
            os: 'multi',
            perOs: {
                windows: [
                    { cmd: 'git init', desc: 'Initialiser un dépôt Git local dans le dossier courant.' },
                    { cmd: 'git add .', desc: 'Ajouter tous les fichiers suivis à l\'index.', },
                    { cmd: 'git commit -m "Premier commit"', desc: 'Créer un premier commit avec un message explicite.' },
                    { cmd: 'git branch -M main', desc: 'Renommer la branche courante en "main" (convention GitHub actuelle).'},
                    { cmd: 'git remote add origin https://github.com/UTILISATEUR/NOM_DU_DEPOT.git', desc: 'Lier le dépôt local au dépôt GitHub (remplacez UTILISATEUR et NOM_DU_DEPOT). Vous pouvez créer le dépôt sur <a href="https://github.com" target="_blank" rel="noreferrer" class="text-accent-400 underline">GitHub</a> au préalable.' },
                    { cmd: 'git push -u origin main', desc: 'Pousser la branche main vers GitHub et définir origin/main comme suivi par défaut.' }
                ],
                macos: [
                    { cmd: 'git init', desc: 'Initialiser un dépôt Git local dans le dossier courant.' },
                    { cmd: 'git add .', desc: 'Ajouter tous les fichiers suivis à l\'index.' },
                    { cmd: 'git commit -m "Premier commit"', desc: 'Créer un premier commit avec un message explicite.' },
                    { cmd: 'git branch -M main', desc: 'Renommer la branche courante en "main".' },
                    { cmd: 'git remote add origin https://github.com/UTILISATEUR/NOM_DU_DEPOT.git', desc: 'Ajouter le dépôt GitHub comme distant "origin" (créez-le via <a href="https://github.com" target="_blank" rel="noreferrer" class="text-accent-400 underline">l\'interface GitHub</a>).'},
                    { cmd: 'git push -u origin main', desc: 'Pousser la branche main sur GitHub et configurer le suivi.' }
                ],
                linux: [
                    { cmd: 'git init', desc: 'Initialiser un dépôt Git local dans le dossier courant.' },
                    { cmd: 'git add .', desc: 'Ajouter tous les fichiers suivis à l\'index.' },
                    { cmd: 'git commit -m "Premier commit"', desc: 'Créer un premier commit.' },
                    { cmd: 'git branch -M main', desc: 'Renommer la branche courante en "main".' },
                    { cmd: 'git remote add origin git@github.com:UTILISATEUR/NOM_DU_DEPOT.git', desc: 'Ajouter le dépôt GitHub comme distant en SSH (assurez-vous que vos clés SSH sont configurées). Le dépôt se crée sur <a href="https://github.com" target="_blank" rel="noreferrer" class="text-accent-400 underline">github.com</a>.' },
                    { cmd: 'git push -u origin main', desc: 'Pousser la branche main et définir le suivi par défaut.' }
                ]
            }
        }
    ];

    // Gestion des favoris (stockage simple via localStorage)
    function loadFavorites() {
        try {
            const raw = localStorage.getItem('netcmd_favorites');
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function saveFavorites(ids) {
        try {
            localStorage.setItem('netcmd_favorites', JSON.stringify(ids));
        } catch (e) {
            // ignore
        }
    }

    let favoriteIds = loadFavorites();

    function isFavorite(id) {
        return favoriteIds.includes(id);
    }

    function toggleFavorite(id) {
        if (isFavorite(id)) {
            favoriteIds = favoriteIds.filter(x => x !== id);
        } else {
            favoriteIds.push(id);
        }
        saveFavorites(favoriteIds);
    }

    function renderFavorites() {
        if (!favResults) return;
        const os = favOsHidden ? (favOsHidden.value || 'windows') : 'windows';
        const items = commandLibrary.filter(item => favoriteIds.includes(item.id));
        renderCommandResults(items, os, favResults, false);
    }

    function renderCommandResults(items, os, container, withFavoriteButtons = false) {
        if (!container) return;
        if (!items.length) {
            container.innerHTML = '<p class="text-zinc-500">Aucun résultat pour cette requête. Essayez avec d\'autres mots-clés.</p>';
            return;
        }

        let html = '';
        items.forEach(item => {
            html += '<div class="border border-zinc-800 rounded-lg p-3 space-y-2 bg-zinc-950/60">';
            html += `<div class="text-[11px] font-semibold text-zinc-100">${item.title}</div>`;

            if (withFavoriteButtons) {
                const favLabel = isFavorite(item.id) ? 'Retirer des favoris' : 'Ajouter aux favoris';
                const favIcon = isFavorite(item.id) ? 'lucide:star-off' : 'lucide:star';
                html += `<button type="button" class="cmd-fav-btn inline-flex items-center gap-1 px-2 py-0.5 rounded border border-amber-500/40 text-[10px] text-amber-300 hover:bg-amber-900/40" data-recipe-id="${item.id}">
                            <iconify-icon icon="${favIcon}" width="10"></iconify-icon>
                            <span>${favLabel}</span>
                         </button>`;
            }

            if (item.os === 'network') {
                html += '<div class="text-[10px] text-zinc-500 mb-1">Contexte: équipement réseau Huawei (CLI).</div>';
                item.steps.forEach(step => {
                    html += `<pre class="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[11px] text-zinc-100 overflow-x-auto">${step.cmd}</pre>`;
                    html += `<p class="text-[11px] text-zinc-400 mb-1">${step.desc}</p>`;
                });
            } else if (item.os === 'multi' && item.perOs) {
                const perOsSteps = item.perOs[os];
                if (!perOsSteps) {
                    html += '<p class="text-[11px] text-zinc-500">Aucune commande spécifique pour cet OS.</p>';
                } else {
                    perOsSteps.forEach(step => {
                        html += `<pre class="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[11px] text-zinc-100 overflow-x-auto">${step.cmd}</pre>`;
                        html += `<p class="text-[11px] text-zinc-400 mb-1">${step.desc}</p>`;
                    });
                }
            }

            html += '</div>';
        });

        container.innerHTML = html;

        if (withFavoriteButtons) {
            container.querySelectorAll('.cmd-fav-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-recipe-id');
                    if (!id) return;
                    toggleFavorite(id);
                    // Re-rendre pour mettre à jour l'état du bouton
                    triggerCmdSearch();
                    renderFavorites();
                });
            });
        }
    }

    function searchCommandLibrary(query, os) {
        const q = (query || '').toLowerCase();
        if (!q) return [];
        const words = q.split(/\s+/).filter(Boolean);
        return commandLibrary.filter(item => {
            const allKeywords = item.keywords.join(' ').toLowerCase();
            return words.some(w => allKeywords.includes(w));
        });
    }

    function triggerCmdSearch() {
        if (!cmdlibQueryInput || !cmdlibOsHidden) return;
        const query = cmdlibQueryInput.value;
        const os = cmdlibOsHidden.value || 'windows';
        const items = searchCommandLibrary(query, os);
        renderCommandResults(items, os, cmdlibResults, true);
    }

    if (cmdlibSearchBtn) {
        cmdlibSearchBtn.addEventListener('click', () => {
            triggerCmdSearch();
        });
    }

    if (cmdlibQueryInput) {
        cmdlibQueryInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                triggerCmdSearch();
            }
        });
    }

    // Génération commande tcpdump
    const trafficBuildBtn = document.getElementById('traffic-build');
    if (trafficBuildBtn) {
        trafficBuildBtn.addEventListener('click', () => {
            const iface = (document.getElementById('traffic-iface') || {}).value || 'eth0';
            const filter = (document.getElementById('traffic-filter') || {}).value || '';
            const mode = (document.getElementById('traffic-mode') || {}).value || 'live';
            const file = (document.getElementById('traffic-file') || {}).value || 'capture.pcap';
            const out = document.getElementById('traffic-output');
            if (!out) return;

            let cmd = `tcpdump -i ${iface}`;
            if (mode === 'pcap') {
                cmd += ` -w ${file}`;
            }
            if (filter.trim() !== '') {
                cmd += ` '${filter.trim()}'`;
            }

            out.textContent = cmd;
        });
    }

    // Génération commande nmap
    const scanBuildBtn = document.getElementById('scan-build');
    if (scanBuildBtn) {
        scanBuildBtn.addEventListener('click', () => {
            const target = (document.getElementById('scan-target') || {}).value || '127.0.0.1';
            const profile = (document.getElementById('scan-profile') || {}).value || '';
            const ports = (document.getElementById('scan-ports') || {}).value || '';
            const extra = (document.getElementById('scan-extra') || {}).value || '';
            const out = document.getElementById('scan-output');
            if (!out) return;

            let cmd = `nmap ${profile}`.trim();
            if (ports.trim() !== '') {
                cmd += ` -p ${ports.trim()}`;
            }
            if (extra.trim() !== '') {
                cmd += ` ${extra.trim()}`;
            }
            cmd += ` ${target.trim()}`;

            out.textContent = cmd;
        });
    }

    // Écouteurs pour mettre à jour la commande en temps réel
    [chainSelect, protocolSelect, ipTypeSelect, sourceInput, ifaceInput, portsInput, logInput, limitInput].forEach(el => {
        if (!el) return;
        const evt = el.tagName === 'SELECT' ? 'change' : 'input';
        el.addEventListener(evt, updateCommand);
    });

    if (invIfaceCheckbox) {
        invIfaceCheckbox.addEventListener('change', updateCommand);
    }

    stateCheckboxes.forEach(cb => cb.addEventListener('change', updateCommand));

    // Initial render
    updateCommand();
    showModule('firewall');
});
