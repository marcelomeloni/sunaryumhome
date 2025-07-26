// No topo do seu arquivo home.js
console.log('Antes da importação do Supabase');
import { supabase } from './supabase.js';
console.log('Supabase importado:', supabase ? 'OK' : 'FALHOU');

// Funções de utilidade
async function wakeUpAPI() {
    try {
        console.log('[WakeUp] Acordando API...');
        const response = await fetch('https://airdrop-sunaryum.onrender.com/api/wallet/ping', {
            method: 'GET',
            cache: 'no-cache'
        });
        if (response.ok) console.log('[WakeUp] API acordada');
    } catch (err) {
        console.error('[WakeUp] Erro ao acordar API:', err);
    }
}

function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;
    
    particlesContainer.innerHTML = '';
    const particleCount = 30;
    
    wakeUpAPI();
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        
        const size = Math.random() * 15 + 5;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${Math.random() * 100}%`;
        
        const duration = Math.random() * 20 + 10;
        const delay = Math.random() * 5;
        particle.style.animationDuration = `${duration}s`;
        particle.style.animationDelay = `${delay}s`;
        
        particlesContainer.appendChild(particle);
    }
}

// Gerenciamento de usuário
async function registerOrUpdateUser(walletAddress) {
    try {
        const username = walletAddress.slice(-4);
        const now = new Date().toISOString();
        
        const { data: existingUser, error: selectError } = await supabase
            .from('users')
            .select('id')
            .eq('wallet_address', walletAddress)
            .maybeSingle();
        
        if (selectError) throw selectError;
        
        if (existingUser) {
    // Atualiza wallet_address se estiver null
    const updates = { last_login: now };
    if (!existingUser.wallet_address) {
        updates.wallet_address = walletAddress;
    }

    const { error: updateError } = await supabase
        .from('users')
        .update(updates)
        .eq('id', existingUser.id);
    if (updateError) throw updateError;
    return existingUser.id;
}
 else {
            const { data: inserted, error: insertError } = await supabase
                .from('users')
                .insert({
                    wallet_address: walletAddress,
                    username,
                    created_at: now,
                    last_login: now,
                    total_checkins: 0 
                })
                .select('id')
                .maybeSingle();
            if (insertError) throw insertError;
            return inserted.id;
        }
    } catch (error) {
        console.error('Erro no registro:', error);
        return null;
    }
}

// Toggle de tema
function setupThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;
    
    if (!themeToggle) return;
    
    const savedTheme = localStorage.getItem('sunaryum-theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
        body.classList.add('dark-theme');
        themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    }
    
    themeToggle.addEventListener('click', () => {
        body.classList.toggle('dark-theme');
        
        if (body.classList.contains('dark-theme')) {
            themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
            localStorage.setItem('sunaryum-theme', 'dark');
        } else {
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            localStorage.setItem('sunaryum-theme', 'light');
        }
    });
}

// Conexão da Wallet
async function setupWalletConnection() {
    const walletAddressEl = document.getElementById('walletAddress');
    const connectBtn = document.getElementById('connectWalletBtn');
    let currentWallet = null;
    
    if (!connectBtn) return;
    
    async function isExtensionInstalled() {
        return new Promise((resolve) => {
            if (window.__SUNARYUM_EXTENSION_INSTALLED__) {
                return resolve(true);
            }
            
            const timeoutId = setTimeout(() => {
                window.removeEventListener('message', responseListener);
                resolve(false);
            }, 800);
            
            function responseListener(event) {
                if (event.source !== window) return;
                if (event.data.type === 'EXTENSION_DETECTION_RESPONSE') {
                    clearTimeout(timeoutId);
                    window.removeEventListener('message', responseListener);
                    resolve(true);
                }
            }
            
            window.addEventListener('message', responseListener);
            window.postMessage({
                type: 'EXTENSION_DETECTION_REQUEST',
                origin: window.location.origin
            }, '*');
        });
    }
    
    async function handleWalletConnect(data) {
        if (!data?.address) {
            console.error('Dados incompletos:', data);
            resetConnectButton();
            return;
        }
        
        const userId = await registerOrUpdateUser(data.address);
        localStorage.setItem('sunaryumWalletAddress', data.address);
        if (userId) localStorage.setItem('sunaryumUserId', userId);
        
        currentWallet = data;
        const shortAddress = `${data.address.slice(0, 6)}...${data.address.slice(-4)}`;
        
        if (walletAddressEl) {
            walletAddressEl.textContent = shortAddress;
            walletAddressEl.style.display = 'block';
        }
        
        await triggerConfettiEffect();
        
        const newBtn = connectBtn.cloneNode(true);
        connectBtn.replaceWith(newBtn);
        newBtn.innerHTML = '<i class="fas fa-rocket"></i> Ir para o Dashboard';
        newBtn.disabled = false;
        newBtn.addEventListener('click', () => {
            window.location.href = '../dashboard/';
        });
    }
    
    async function triggerConfettiEffect() {
        return new Promise(resolve => {
            const particlesContainer = document.getElementById('particles');
            if (!particlesContainer) return resolve();
            
            const burstParticles = 50;
            for (let i = 0; i < burstParticles; i++) {
                const particle = document.createElement('div');
                particle.classList.add('particle', 'burst-particle');
                
                const size = Math.random() * 20 + 5;
                const color = `hsl(${Math.random() * 60 + 30}, 100%, 50%)`;
                const duration = Math.random() * 2 + 1;
                
                particle.style.width = `${size}px`;
                particle.style.height = `${size}px`;
                particle.style.backgroundColor = color;
                particle.style.left = `${Math.random() * 100}%`;
                particle.style.top = `${Math.random() * 100}%`;
                particle.style.animation = `burstAnimation ${duration}s forwards`;
                
                particlesContainer.appendChild(particle);
                setTimeout(() => particle.remove(), duration * 1000);
            }
            setTimeout(resolve, 1000);
        });
    }
    
    function resetConnectButton() {
        connectBtn.innerHTML = 'Conectar Carteira <i class="fas fa-plug"></i>';
        connectBtn.disabled = false;
    }
    
    connectBtn.addEventListener('click', async () => {
        console.log('Botão Conectar Clicado');
        const installed = await isExtensionInstalled();
        
        if (!installed) {
            console.log('Extensão não detectada, abrindo modal');
            openModal(noExtensionModal);
            return;
        }
        
        connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Conectando...';
        connectBtn.disabled = true;
        
        window.postMessage({
            type: 'OPEN_WALLET_CONNECT',
            origin: window.location.origin
        }, '*');
        
        setTimeout(() => {
            if (!currentWallet) {
                resetConnectButton();
                alert('Tempo esgotado! Verifique a extensão.');
            }
        }, 5000);
    });
    
    window.addEventListener('message', (event) => {
        if (event.data.type === 'WALLET_CONNECTED') {
            if (event.data.data?.address) {
                handleWalletConnect(event.data.data);
            } else if (event.data.address) {
                handleWalletConnect({
                    address: event.data.address,
                    publicKey: event.data.publicKey
                });
            } else {
                console.error('Formato inválido:', event.data);
                resetConnectButton();
            }
        }
    });
    
    if (typeof browser !== 'undefined') {
        window.addEventListener('message', (event) => {
            if (event.data.type === 'OPEN_WALLET_CONNECT') {
                browser.runtime.sendMessage({
                    action: "openConnectWindow",
                    origin: event.data.origin
                });
            }
        });
        
        browser.runtime.onMessage.addListener((msg) => {
            if (msg.action === "walletDataUpdate") {
                window.postMessage({
                    type: 'WALLET_CONNECTED',
                    data: msg.data
                }, '*');
            }
        });
    }
    
    return { getWalletState: () => currentWallet };
}

// Sistema de Modais
const noExtensionModal = document.getElementById('noExtensionModal');
const walletCreationModal = document.getElementById('walletCreationModal');
const closeButtons = document.querySelectorAll('.close');
const modalState = {
    isSeedVisible: false,
    generated: false
};

const modalElements = {
    generateSeedBtn: document.getElementById('generateSeedBtn'),
    toggleVisibilityBtn: document.getElementById('toggleVisibilityBtn'),
    copySeedBtn: document.getElementById('copySeedBtn'),
    continueBtn: document.getElementById('continueBtn'),
    seedPhraseGrid: document.getElementById('seedPhraseGrid'),
    seedInput: document.getElementById('seedInput'),
    importBtn: document.getElementById('importBtn'),
    importStatus: document.getElementById('importStatus'),
    goToDashboardBtn: document.getElementById('goToDashboardBtn'),
    createTab: document.querySelector('[data-tab="create"]'),
    importTab: document.querySelector('[data-tab="import"]'),
    createWalletTab: document.getElementById('createWalletTab'),
    importWalletTab: document.getElementById('importWalletTab')
};

let walletData = null;

function resetModalState() {
    modalState.isSeedVisible = false;
    modalState.generated = false;
    walletData = null;
    
    if (modalElements.seedPhraseGrid) 
        modalElements.seedPhraseGrid.innerHTML = '';
    
    if (modalElements.importStatus) {
        modalElements.importStatus.textContent = '';
        modalElements.importStatus.className = 'status-message';
    }
    
    if (modalElements.generateSeedBtn) {
        modalElements.generateSeedBtn.innerHTML = '<i class="fas fa-sync"></i> Generate New Seed';
        modalElements.generateSeedBtn.disabled = false;
    }
    
    updateVisibilityUI();
    updateModalUIState();
}

function openModal(modal) {
    if (!modal) return;
    modal.style.display = 'flex';
    
    if (modal.id === 'walletCreationModal') {
        resetModalState();
    }
}

function closeModal(modal) {
    if (!modal) return;
    modal.style.display = 'none';
}

function setupModalEventListeners() {
    if (modalElements.generateSeedBtn) {
        modalElements.generateSeedBtn.addEventListener('click', generateSeedPhrase);
    }
    
    if (modalElements.toggleVisibilityBtn) {
        modalElements.toggleVisibilityBtn.addEventListener('click', toggleSeedVisibility);
    }
    
    if (modalElements.copySeedBtn) {
        modalElements.copySeedBtn.addEventListener('click', copySeedPhrase);
    }
    
    if (modalElements.continueBtn) {
        modalElements.continueBtn.addEventListener('click', handleWalletCreation);
    }
    
    if (modalElements.importBtn) {
        modalElements.importBtn.addEventListener('click', importWallet);
    }
    
    if (modalElements.goToDashboardBtn) {
        modalElements.goToDashboardBtn.addEventListener('click', () => {
            window.location.href = '../dashboard/';
        });
    }
}

async function generateSeedPhrase() {
    if (!modalElements.generateSeedBtn) return;
    
    try {
        const originalHTML = modalElements.generateSeedBtn.innerHTML;
        modalElements.generateSeedBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        modalElements.generateSeedBtn.disabled = true;
        
        const res = await fetch('https://airdrop-sunaryum.onrender.com/api/wallet/create');
        if (!res.ok) throw new Error('Erro no servidor');
        
        walletData = await res.json();
        renderSeedPhrase(walletData.mnemonic);
        
        modalElements.generateSeedBtn.innerHTML = originalHTML;
        modalElements.generateSeedBtn.disabled = false;
        modalState.generated = true;
        updateModalUIState();
        
    } catch (error) {
        console.error('Erro na geração:', error);
        modalElements.generateSeedBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Erro - Tentar novamente';
        
        setTimeout(() => {
            modalElements.generateSeedBtn.innerHTML = '<i class="fas fa-sync"></i> Generate Seed';
            modalElements.generateSeedBtn.disabled = false;
        }, 2000);
    }
}

function renderSeedPhrase(mnemonic) {
    if (!modalElements.seedPhraseGrid) return;
    
    modalElements.seedPhraseGrid.innerHTML = '';
    const words = mnemonic.split(' ');
    
    words.forEach((word, index) => {
        const wordEl = document.createElement('div');
        wordEl.className = 'seed-word';
        wordEl.dataset.word = word;
        
        wordEl.innerHTML = `
            <span class="word-index">${index + 1}</span>
            <span class="word-content">${'•'.repeat(word.length)}</span>
        `;
        
        modalElements.seedPhraseGrid.appendChild(wordEl);
    });
}

function toggleSeedVisibility() {
    modalState.isSeedVisible = !modalState.isSeedVisible;
    updateVisibilityUI();
    toggleSeedWords();
}

function updateVisibilityUI() {
    const icon = modalElements.toggleVisibilityBtn?.querySelector('i');
    const textSpan = modalElements.toggleVisibilityBtn?.querySelector('span');
    
    if (textSpan) {
        textSpan.textContent = modalState.isSeedVisible ? 'Hide Seed' : 'Show Seed';
    }
    
    if (icon) {
        icon.className = modalState.isSeedVisible ? 
            'fas fa-eye-slash' : 'fas fa-eye';
    }
}

function toggleSeedWords() {
    const words = document.querySelectorAll('.seed-word');
    words.forEach(word => {
        const content = word.querySelector('.word-content');
        if (!content) return;
        
        if (modalState.isSeedVisible) {
            content.textContent = word.dataset.word;
            content.classList.add('visible');
        } else {
            content.textContent = '•'.repeat(word.dataset.word?.length || 5);
            content.classList.remove('visible');
        }
    });
}

function copySeedPhrase() {
    if (!walletData) return;
    
    navigator.clipboard.writeText(walletData.mnemonic)
        .then(() => {
            const span = modalElements.copySeedBtn.querySelector('span');
            if (span) {
                const originalText = span.textContent;
                span.textContent = 'Copied!';
                modalElements.copySeedBtn.disabled = true;
                
                setTimeout(() => {
                    span.textContent = originalText;
                    modalElements.copySeedBtn.disabled = false;
                }, 2000);
            }
        })
        .catch(console.error);
}

function updateModalUIState() {
    if (modalElements.copySeedBtn) {
        modalElements.copySeedBtn.disabled = !modalState.generated;
    }
    
    if (modalElements.continueBtn) {
        modalElements.continueBtn.disabled = !modalState.generated;
    }
}

async function handleWalletCreation() {
    if (!walletData) return;
    
    modalElements.seedInput.value = walletData.mnemonic;
    modalElements.importTab.click();
    
    modalElements.importStatus.textContent = 'Processing your new wallet...';
    modalElements.importStatus.className = 'status-message';
    
    setTimeout(importWallet, 1000);
}

function showImportStatus(message, type) {
    if (!modalElements.importStatus) return;
    
    modalElements.importStatus.textContent = message;
    modalElements.importStatus.className = 'status-message';
    
    if (type === 'error') {
        modalElements.importStatus.classList.add('error');
    } else if (type === 'success') {
        modalElements.importStatus.classList.add('success');
    } else if (type === 'loading') {
        modalElements.importStatus.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${message}`;
    }
}

async function importWallet() {
    const seed = modalElements.seedInput.value.trim();
    const words = seed.split(/\s+/);
    
    if (words.length !== 12) {
        showImportStatus('Please enter a valid 12 word seed.', 'error');
        return;
    }
    
    showImportStatus('Importing your wallet...', 'loading');
    
    try {
        const res = await fetch('https://airdrop-sunaryum.onrender.com/api/wallet/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mnemonic: seed })
        });
        
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || 'Erro na resposta do servidor');
        }
        
        const data = await res.json();
        saveWalletData(data);
        await finalizeWalletSetup(data.address);
        showImportStatus('✅ Wallet imported successfully! Redirecting...', 'success');
        
    } catch (error) {
        console.error('Erro na importação:', error);
        showImportStatus(`Falha na importação: ${error.message}`, 'error');
    }
}

function saveWalletData(data) {
    const walletData = {
        address: data.address,
        public_key: data.public_key,
        private_key: data.private_key,
        mnemonic: modalElements.seedInput.value.trim()
    };
    
    localStorage.setItem('walletData', JSON.stringify(walletData));
}

async function finalizeWalletSetup(address) {
    const userId = await registerOrUpdateUser(address);
    
    if (userId) {
        localStorage.setItem('sunaryumWalletAddress', address);
        localStorage.setItem('sunaryumUserId', userId);
        
        setTimeout(() => {
            window.location.href = '../dashboard/';
        }, 2000);
        return true;
    }
    return false;
}

function setupModals() {
    const installExtensionOption = document.getElementById('installExtensionOption');
    const createWalletOption = document.getElementById('createWalletOption');
    const connectWithoutExtensionBtn = document.getElementById('connectWithoutExtensionBtn');
    
    if (connectWithoutExtensionBtn) {
        connectWithoutExtensionBtn.addEventListener('click', () => {
            closeModal(noExtensionModal);
            openModal(walletCreationModal);
        });
    }
    
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal');
            closeModal(modal);
        });
    });
    
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            closeModal(event.target);
        }
    });
    
    if (installExtensionOption) {
        installExtensionOption.addEventListener('click', () => {
            window.open('https://addons.mozilla.org/firefox/addon/sunaryum-wallet/', '_blank');
        });
    }
    
    if (createWalletOption) {
        createWalletOption.addEventListener('click', () => {
            closeModal(noExtensionModal);
            openModal(walletCreationModal);
        });
    }
    
    if (modalElements.createTab && modalElements.importTab) {
        [modalElements.createTab, modalElements.importTab].forEach(tab => {
            tab.addEventListener('click', () => {
                [modalElements.createTab, modalElements.importTab].forEach(t => 
                    t.classList.remove('active'));
                tab.classList.add('active');
                
                [modalElements.createWalletTab, modalElements.importWalletTab].forEach(content => 
                    content.classList.remove('active'));
                
                if (tab.dataset.tab === 'create') {
                    modalElements.createWalletTab.classList.add('active');
                } else {
                    modalElements.importWalletTab.classList.add('active');
                }
            });
        });
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    setupThemeToggle();
    setupWalletConnection();
    createParticles();
    setupModals();
    setupModalEventListeners();
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
    `;
    document.head.appendChild(style);
    
    document.addEventListener('walletConnected', (e) => {
        console.log('Carteira conectada:', e.detail);
    });
});
