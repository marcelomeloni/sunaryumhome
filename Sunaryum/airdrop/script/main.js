import { supabase } from './supabase.js';
import { 
    initializeUserMissions, 
    loadUserMissions, 
    handleMissionAction, 
    loadUserAchievements,
    updateReferralMissionProgress
} from './missions.js';
export { supabase }
// Elementos da UI
const walletAddressEl = document.querySelector('.wallet-address');
const streakDaysEl = document.getElementById('streak-days');
const xpPointsEl = document.getElementById('xp-points');
const sunBalanceEl = document.getElementById('sun-balance');
const streakProgressEl = document.getElementById('streak-progress');
const xpProgressEl = document.getElementById('xp-progress');
const userLevelEl = document.getElementById('user-level');
const missionsContainer = document.getElementById('missions-container');
const achievementsContainer = document.getElementById('achievements-container');
const leaderboardContainer = document.getElementById('leaderboard-container');
const headerStreakEl = document.getElementById('header-streak');
const checkinButton = document.getElementById('checkin-button');

// Dados do usuário
export let currentUser = null;
let checkinTimer = null;

// Sistema de notificação
const notificationContainer = document.createElement('div');
notificationContainer.className = 'fixed top-4 right-4 z-50 space-y-3';
document.body.appendChild(notificationContainer);

export function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `px-6 py-4 rounded-lg shadow-lg text-white font-bold flex items-center ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`;
    notification.innerHTML = `
        ${type === 'success' ? '✅' : '⚠️'}
        <span class="ml-3">${message}</span>
    `;

    notificationContainer.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('opacity-0', 'transition-opacity', 'duration-300');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Funções de carregamento
export function showLoading() {
    document.getElementById('loading-overlay').classList.remove('hidden');
}

export function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
}

// Inicialização da página
document.addEventListener('DOMContentLoaded', async () => {
    const walletAddress = localStorage.getItem('sunaryumWalletAddress');
    const userId = localStorage.getItem('sunaryumUserId');

    if (!walletAddress || !userId) {
        window.location.href = '/';
        return;
    }

    const shortAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
    if (walletAddressEl) walletAddressEl.textContent = shortAddress;

    showLoading();
    try {
        await loadUserData(userId);
        await initializeUserMissions(userId);
        await loadUserMissions();
        await loadUserAchievements();
        await loadLeaderboard();
        await loadReferralData();
        setupEventListeners();
        startCheckinTimer();
    } catch (error) {
        console.error('Initialization error:', error);
        showNotification('Failed to load data. Please try again.', 'error');
    } finally {
        hideLoading();
    }
});

// Função para calcular multiplicador de XP
function calculateXPMultiplier(streak) {
    return 1 + Math.floor(streak / 3) * 0.5;
}

// Função para iniciar timer de check-in
function startCheckinTimer() {
    if (checkinTimer) clearInterval(checkinTimer);
    updateCheckinButton();
    checkinTimer = setInterval(updateCheckinButton, 60000);
}

// Função para atualizar o botão de check-in
async function updateCheckinButton() {
    if (!currentUser) return;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    try {
        const { data, error } = await supabase
            .from('checkins')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('checkin_date', todayStr);

        if (error) throw error;

        if (data.length > 0) {
            checkinButton.disabled = true;
            checkinButton.classList.remove('bg-solar', 'hover:bg-solar-dark');
            checkinButton.classList.add('bg-gray-800', 'hover:bg-gray-700');

            const now = new Date();
            const midnight = new Date();
            midnight.setUTCHours(24, 0, 0, 0);

            const diffMs = midnight - now;
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

            checkinButton.textContent = `Next check-in: ${diffHours}h ${diffMinutes}m`;
        } else {
            checkinButton.disabled = false;
            checkinButton.classList.remove('bg-gray-800', 'hover:bg-gray-700');
            checkinButton.classList.add('bg-solar', 'hover:bg-solar-dark');
            checkinButton.textContent = 'Daily Check-in';
        }
    } catch (error) {
        console.error('Error checking check-in status:', error);
    }
}

// Configurar event listeners
function setupEventListeners() {
    checkinButton.addEventListener('click', handleDailyCheckin);

    document.getElementById('logout-button').addEventListener('click', () => {
        localStorage.removeItem('sunaryumWalletAddress');
        localStorage.removeItem('sunaryumUserId');
        window.location.href = '/';
    });

    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active', 'border-solar', 'text-solar');
                btn.classList.add('text-gray-400');
            });

            button.classList.add('active', 'border-b-2', 'border-solar', 'text-solar');
            button.classList.remove('text-gray-400');

            const page = button.dataset.page;
            document.getElementById('missions-page').classList.toggle('hidden', page !== 'missions');
            document.getElementById('leaderboard-page').classList.toggle('hidden', page !== 'leaderboard');

            if (page === 'leaderboard') {
                showLoading();
                loadLeaderboard().finally(hideLoading);
            }
        });
    });
}

// Calcular nível do usuário
export function calculateLevel(xp) {
    return Math.floor(xp / 1000) + 1;
}

// Carregar dados do usuário
async function loadUserData(userId) {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;

        currentUser = data;

        const level = calculateLevel(data.xp_points);
        const xpForNextLevel = level * 1000;
        const xpProgress = (data.xp_points % 1000) / 10;
        const streakProgress = (data.streak_days / 7) * 100;

        if (streakDaysEl) streakDaysEl.textContent = data.streak_days;
        if (xpPointsEl) xpPointsEl.textContent = data.xp_points.toLocaleString();
        if (sunBalanceEl) sunBalanceEl.textContent = data.sun_balance.toLocaleString();
        if (headerStreakEl) headerStreakEl.textContent = `${data.streak_days}/7 days`;

        if (streakProgressEl) streakProgressEl.style.width = `${streakProgress}%`;
        if (xpProgressEl) xpProgressEl.style.width = `${xpProgress}%`;
        if (userLevelEl) userLevelEl.textContent = `Level ${level} • Next level at ${xpForNextLevel} XP`;

    } catch (error) {
        console.error('Error loading user data:', error);
        showNotification('Failed to load user data.', 'error');
    }
}

// Carregar leaderboard
async function loadLeaderboard() {
    if (!leaderboardContainer) return;

    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, wallet_address, xp_points, sun_balance')
            .order('xp_points', { ascending: false })
            .limit(10);

        if (error) throw error;

        leaderboardContainer.innerHTML = '';

        data.forEach((user, index) => {
            const walletAddress = user.wallet_address || '';
            const shortAddress = walletAddress
                ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                : 'Unknown';

            const level = calculateLevel(user.xp_points);
            const xpPercent = (user.xp_points % 1000) / 10;

            const rankCard = document.createElement('div');
            rankCard.className = `glass-panel leaderboard-card p-4 flex items-center relative ${index === 0 ? 'border border-solar rounded-xl' : ''}`;

            rankCard.innerHTML = `
                <div class="w-8 h-8 flex items-center justify-center ${index === 0 ? 'bg-gradient-to-br from-yellow-300 to-yellow-600' :
                    index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                        index === 2 ? 'bg-gradient-to-br from-amber-700 to-amber-900' : 'bg-gray-800'
                } rounded-full mr-4">
                    <span class="font-bold ${index < 3 ? 'text-gray-900' : ''}">${index + 1}</span>
                </div>
                <div class="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center mr-4">
                    <span class="text-lg">${index === 0 ? '👑' : index === 1 ? '🚀' : index === 2 ? '💎' : '🔥'}</span>
                </div>
                <div class="flex-1">
                    <div class="font-bold">${shortAddress}</div>
                    <div class="text-xs text-gray-400">Level ${level}</div>
                </div>
                <div class="flex items-center">
                    <span class="text-lg mr-1">🌞</span>
                    <span class="font-bold">${user.sun_balance.toLocaleString()}</span>
                </div>
                <div class="ml-6">
                    <div class="w-16 bg-gray-800 rounded-full h-2">
                        <div class="solar-gradient h-2 rounded-full" style="width: ${xpPercent}%"></div>
                    </div>
                    <div class="text-xs text-gray-400 mt-1">XP: ${user.xp_points.toLocaleString()}</div>
                </div>
            `;

            leaderboardContainer.appendChild(rankCard);
        });

    } catch (error) {
        console.error('Error loading leaderboard:', error);
        showNotification('Failed to load leaderboard.', 'error');
    }
}

// Função para check-in diário
async function handleDailyCheckin() {
    if (!currentUser) return;

    const originalText = checkinButton.textContent;
    checkinButton.disabled = true;
    checkinButton.textContent = 'Processing...';

    showLoading();
    try {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('checkins')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('checkin_date', todayStr);

        if (error) throw error;

        if (data.length > 0) {
            showNotification('You have already checked in today!', 'info');
            return;
        }

        const { error: insertError } = await supabase
            .from('checkins')
            .insert([{
                user_id: currentUser.id,
                checkin_date: todayStr
            }]);

        if (insertError) throw insertError;

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const { data: yesterdayCheckin } = await supabase
            .from('checkins')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('checkin_date', yesterdayStr);

        const newStreak = yesterdayCheckin.length > 0 ? currentUser.streak_days + 1 : 1;
        const baseXP = 10;
        const xpMultiplier = 1 + Math.floor(newStreak / 3) * 0.5;
        const xpEarned = Math.round(baseXP * xpMultiplier);

        const { error: updateError } = await supabase
            .from('users')
            .update({
                streak_days: newStreak,
                total_checkins: currentUser.total_checkins + 1,
                xp_points: currentUser.xp_points + xpEarned,
                sun_balance: currentUser.sun_balance + 5
            })
            .eq('id', currentUser.id);

        if (updateError) throw updateError;

        await loadUserData(currentUser.id);
        showNotification(`Daily check-in successful! +${xpEarned} XP +5 SUN`, 'success');

    } catch (error) {
        console.error('Check-in error:', error);
        showNotification('Error processing check-in', 'error');
    } finally {
        hideLoading();
        checkinButton.disabled = false;
        startCheckinTimer();
    }
}

// Validação de referral
function validateReferralCode(code) {
    if (!code) return "Código referral não pode estar vazio";
    if (code.length !== 6) return "Código deve ter exatamente 6 caracteres";
    if (!/^[A-Z0-9]{6}$/.test(code)) return "Código deve conter apenas letras maiúsculas e números";
    if (currentUser.referral_code === code) return "Você não pode usar seu próprio código";
    if (currentUser.referred_by) return "Você já usou um código referral anteriormente";
    return null;
}

async function applyReferralCode() {
    const input = document.getElementById('referral-input');
    const button = document.getElementById('submit-referral');

    if (!input || !button) return;

    const code = input.value.trim().toUpperCase();
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Applying...';
    showLoading();

    try {
        const validationError = validateReferralCode(code);
        if (validationError) throw new Error(validationError);

        // GERAR CÓDIGO AUTOMATICAMENTE SE O USUÁRIO NÃO TIVER UM
        if (!currentUser.referral_code) {
            await generateReferralCode(false); // false = não mostrar notificação
        }

        const { data: referralOwner, error: findError } = await supabase
            .from('users')
            .select('id, referral_count')
            .eq('referral_code', code)
            .single();

        if (findError || !referralOwner) throw new Error('Invalid referral code or not found');

        const { error: updateError } = await supabase
            .from('users')
            .update({ referred_by: code })
            .eq('id', currentUser.id);

        if (updateError) throw updateError;

        const { error: countUpdateError } = await supabase
            .from('users')
            .update({ referral_count: referralOwner.referral_count + 1 })
            .eq('id', referralOwner.id);

        if (countUpdateError) throw countUpdateError;

        showNotification('Referral code applied successfully!');
        input.value = '';
        
        if (referralOwner) {
            const newCount = (referralOwner.referral_count || 0) + 1;
            const tempUser = currentUser;
            currentUser = { ...referralOwner, referral_count: newCount };
            await updateReferralMissionProgress();
            currentUser = tempUser;
        }
        
        await loadUserData(currentUser.id);
        await loadReferralData();

    } catch (error) {
        console.error('Error applying referral code:', error);
        showNotification(error.message || 'Failed to apply referral code', 'error');
    } finally {
        hideLoading();
        button.disabled = false;
        button.textContent = originalText;
    }
}
// Função para mostrar notificação de cópia
function showCopiedNotification() {
    const notification = document.getElementById('copied-notification');
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 2000);
}

// Função para copiar o endereço
function copyAddressToClipboard() {
    const fullAddress = localStorage.getItem('sunaryumWalletAddress');
    
    navigator.clipboard.writeText(fullAddress)
        .then(() => {
            showCopiedNotification();
        })
        .catch(err => {
            console.error('Failed to copy: ', err);
            showNotification('Failed to copy address', 'error');
        });
}

// Adicionar evento ao botão de cópia
document.addEventListener('DOMContentLoaded', function() {
    const copyButton = document.getElementById('copy-address');
    if (copyButton) {
        copyButton.addEventListener('click', copyAddressToClipboard);
    }
});

async function generateReferralCode(showSuccessNotification = true) {
    const button = document.getElementById('generate-referral');
    if (button) {
        button.disabled = true;
        const originalText = button.textContent;
        button.textContent = 'Generating...';
    }
    
    showLoading();

    try {
        let referralCode;
        let isUnique = false;
        let attempts = 0;

        while (!isUnique && attempts < 5) {
            referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const { count, error } = await supabase
                .from('users')
                .select('*', { count: 'exact' })
                .eq('referral_code', referralCode);

            if (error) throw error;
            if (count === 0) isUnique = true;
            attempts++;
        }

        if (!isUnique) throw new Error('Could not generate a unique code. Please try again.');

        const { error } = await supabase
            .from('users')
            .update({ referral_code: referralCode })
            .eq('id', currentUser.id);

        if (error) throw error;

        currentUser.referral_code = referralCode;
        
        // Mostrar notificação apenas se solicitado
        if (showSuccessNotification) {
            showNotification('Referral code generated successfully!');
        }
        
        await updateReferralMissionProgress();
        await loadReferralData();

        return referralCode; // Retorna o código gerado

    } catch (error) {
        console.error('Error generating referral code:', error);
        showNotification(error.message || 'Failed to generate referral code', 'error');
        if (button) {
            button.disabled = false;
            button.textContent = originalText;
        }
        throw error; // Propaga o erro para quem chamou
    } finally {
        hideLoading();
    }
}

// Configurar botão de cópia
function setupCopyButton() {
    document.getElementById('referral-code-container').addEventListener('click', (e) => {
        if (e.target.id === 'copy-referral') {
            navigator.clipboard.writeText(currentUser.referral_code);
            showNotification('Código copiado para a área de transferência!');
            e.target.textContent = 'Copiado!';
            setTimeout(() => e.target.textContent = 'Copy', 2000);
        }
    });
}

// Carregar dados de referral
async function loadReferralData() {
    if (!currentUser) return;

    try {
        const referralCountEl = document.getElementById('referral-count');
        if (referralCountEl) referralCountEl.textContent = currentUser.referral_count || 0;
        
        const generateBtn = document.getElementById('generate-referral');
        const copyBtn = document.getElementById('copy-referral');
        const submitBtn = document.getElementById('submit-referral');
        const referralInput = document.getElementById('referral-input');

        if (generateBtn) generateBtn.onclick = null;
        if (copyBtn) copyBtn.onclick = null;
        if (submitBtn) submitBtn.onclick = null;
        if (referralInput) referralInput.onkeypress = null;

        if (currentUser.referred_by) {
            const actionContainer = document.getElementById('referral-action-container');
            if (actionContainer) {
                actionContainer.innerHTML = `
                    <h3 class="font-bold text-lg mb-3">Referral Used</h3>
                    <div class="flex items-center">
                        <div class="flex-1 bg-gray-800 text-solar-light px-4 py-2 rounded-lg font-mono font-bold text-center">
                            ${currentUser.referred_by}
                        </div>
                    </div>
                    <p class="text-green-500 text-sm mt-2 text-center">✓ You used this code</p>
                `;
            }

            const codeContainer = document.getElementById('referral-code-container');
            if (codeContainer) {
                codeContainer.innerHTML = `
                    <div class="flex w-full">
                        <div class="flex-1 bg-gray-800 text-solar-light px-4 py-2 rounded-l-lg font-mono font-bold">${currentUser.referral_code || 'N/A'}</div>
                        <button id="copy-referral" class="bg-solar hover:bg-solar-dark text-gray-900 font-bold px-4 py-2 rounded-r-lg transition">
                            Copy
                        </button>
                    </div>
                `;

                const newCopyBtn = document.getElementById('copy-referral');
                if (newCopyBtn) {
                    newCopyBtn.addEventListener('click', () => {
                        navigator.clipboard.writeText(currentUser.referral_code);
                        showNotification('Copied to clipboard!');
                        newCopyBtn.textContent = 'Copied!';
                        setTimeout(() => newCopyBtn.textContent = 'Copy', 2000);
                    });
                }
            }
        } else {
            const actionContainer = document.getElementById('referral-action-container');
            if (actionContainer) {
                actionContainer.innerHTML = `
                    <h3 class="font-bold text-lg mb-3">Use a Referral Code</h3>
                    <div class="flex">
                        <input id="referral-input" type="text" placeholder="Enter referral code" class="flex-1 bg-gray-800 text-white px-4 py-2 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-solar">
                        <button id="submit-referral" class="bg-solar hover:bg-solar-dark text-gray-900 font-bold px-4 py-2 rounded-r-lg transition">Apply</button>
                    </div>
                `;
            }

            const codeContainer = document.getElementById('referral-code-container');
            if (codeContainer) {
                if (currentUser.referral_code) {
                    codeContainer.innerHTML = `
                        <div class="flex w-full">
                            <div class="flex-1 bg-gray-800 text-solar-light px-4 py-2 rounded-l-lg font-mono font-bold">${currentUser.referral_code}</div>
                            <button id="copy-referral" class="bg-solar hover:bg-solar-dark text-gray-900 font-bold px-4 py-2 rounded-r-lg transition">
                                Copy
                            </button>
                        </div>
                    `;
                } else {
                    codeContainer.innerHTML = `
                        <button id="generate-referral" class="bg-solar hover:bg-solar-dark text-gray-900 font-bold px-4 py-2 rounded-lg transition w-full">
                            Generate Referral Code
                        </button>
                    `;
                }
            }

            setTimeout(() => {
                const newGenerateBtn = document.getElementById('generate-referral');
                const newCopyBtn = document.getElementById('copy-referral');
                const newSubmitBtn = document.getElementById('submit-referral');
                const newReferralInput = document.getElementById('referral-input');

                if (newGenerateBtn) newGenerateBtn.addEventListener('click', generateReferralCode);
                if (newCopyBtn) newCopyBtn.addEventListener('click', setupCopyButton);
                if (newSubmitBtn) newSubmitBtn.addEventListener('click', applyReferralCode);
                if (newReferralInput) {
                    newReferralInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') applyReferralCode();
                    });
                }
            }, 100);
        }
    } catch (error) {
        console.error('Error loading referral data:', error);
        showNotification('Failed to load referral data.', 'error');
    }
}