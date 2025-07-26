import { supabase } from './supabase.js';

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
let currentUser = null;
let checkinTimer = null;

// Sistema de notificação
const notificationContainer = document.createElement('div');
notificationContainer.className = 'fixed top-4 right-4 z-50 space-y-3';
document.body.appendChild(notificationContainer);

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `px-6 py-4 rounded-lg shadow-lg text-white font-bold flex items-center ${type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`;
    notification.innerHTML = `
        ${type === 'success' ? '✅' : '⚠️'}
        <span class="ml-3">${message}</span>
    `;

    notificationContainer.appendChild(notification);

    // Remover após 3 segundos
    setTimeout(() => {
        notification.classList.add('opacity-0', 'transition-opacity', 'duration-300');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Funções de carregamento
function showLoading() {
    document.getElementById('loading-overlay').classList.remove('hidden');
}

function hideLoading() {
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

    // Atualizar UI com endereço encurtado
    const shortAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
    if (walletAddressEl) walletAddressEl.textContent = shortAddress;

    showLoading();
    try {
        await loadUserData(userId);
        await initializeUserMissions(userId);
        await loadUserMissions();
        await loadUserAchievements();
        await loadLeaderboard();
        await loadReferralData()
        setupEventListeners();

        // Iniciar timer para verificar check-in
        startCheckinTimer();
    } catch (error) {
        console.error('Initialization error:', error);
        showNotification('Failed to load data. Please try again.', 'error');
    } finally {
        hideLoading();
    }
});

// Função para calcular multiplicador de XP baseado no streak
function calculateXPMultiplier(streak) {
    // Multiplicador aumenta a cada 3 dias de streak
    return 1 + Math.floor(streak / 3) * 0.5;
}

// Função para iniciar timer de check-in
function startCheckinTimer() {
    // Limpar timer anterior se existir
    if (checkinTimer) clearInterval(checkinTimer);

    // Atualizar imediatamente
    updateCheckinButton();

    // Atualizar a cada minuto
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
            // Usuário já fez check-in hoje - mostrar timer
            checkinButton.disabled = true;
            checkinButton.classList.remove('bg-solar', 'hover:bg-solar-dark');
            checkinButton.classList.add('bg-gray-800', 'hover:bg-gray-700');

            // Calcular tempo até meia-noite (UTC)
            const now = new Date();
            const midnight = new Date();
            midnight.setUTCHours(24, 0, 0, 0);

            const diffMs = midnight - now;
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

            checkinButton.textContent = `Next check-in: ${diffHours}h ${diffMinutes}m`;
        } else {
            // Usuário pode fazer check-in
            checkinButton.disabled = false;
            checkinButton.classList.remove('bg-gray-800', 'hover:bg-gray-700');
            checkinButton.classList.add('bg-solar', 'hover:bg-solar-dark');
            checkinButton.textContent = 'Daily Check-in';
        }
    } catch (error) {
        console.error('Error checking check-in status:', error);
    }
}

// Função para inicializar missões do usuário
async function initializeUserMissions(userId) {
    try {
        // Verificar se o usuário já tem missões
        const { data: existingMissions, error: countError } = await supabase
            .from('user_missions')
            .select('id', { count: 'exact' })
            .eq('user_id', userId);

        if (countError) throw countError;

        // Se já tem missões, não precisa criar
        if (existingMissions && existingMissions.length > 0) return;

        // Obter todas as missões disponíveis
        const { data: allMissions, error: missionsError } = await supabase
            .from('missions')
            .select('id');

        if (missionsError) throw missionsError;

        // Criar missões para o usuário
        const missionsToCreate = allMissions.map(mission => ({
            user_id: userId,
            mission_id: mission.id,
            progress: 0,
            completed: false
        }));

        // Inserir todas as missões de uma vez
        const { error: insertError } = await supabase
            .from('user_missions')
            .insert(missionsToCreate);

        if (insertError) throw insertError;

    } catch (error) {
        console.error('Error initializing user missions:', error);
        showNotification('Failed to initialize missions.', 'error');
    }
}

// Configurar event listeners
function setupEventListeners() {
    // Botão de check-in
    checkinButton.addEventListener('click', handleDailyCheckin);

    // Botão de logout
    document.getElementById('logout-button').addEventListener('click', () => {
        localStorage.removeItem('sunaryumWalletAddress');
        localStorage.removeItem('sunaryumUserId');
        window.location.href = '/';
    });

    // Tabs de navegação
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            // Remover classe ativa de todos os botões
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active', 'border-solar', 'text-solar');
                btn.classList.add('text-gray-400');
            });

            // Adicionar classe ativa ao botão clicado
            button.classList.add('active', 'border-b-2', 'border-solar', 'text-solar');
            button.classList.remove('text-gray-400');

            // Mostrar a página correspondente
            const page = button.dataset.page;
            document.getElementById('missions-page').classList.toggle('hidden', page !== 'missions');
            document.getElementById('leaderboard-page').classList.toggle('hidden', page !== 'leaderboard');

            // Recarregar o leaderboard se necessário
            if (page === 'leaderboard') {
                showLoading();
                loadLeaderboard().finally(hideLoading);
            }
        });
    });
}

// Calcular nível do usuário
function calculateLevel(xp) {
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

        // Calcular nível e progresso
        const level = calculateLevel(data.xp_points);
        const xpForNextLevel = level * 1000;
        const xpProgress = (data.xp_points % 1000) / 10;
        const streakProgress = (data.streak_days / 7) * 100;

        // Atualizar UI
        if (streakDaysEl) streakDaysEl.textContent = data.streak_days;
        if (xpPointsEl) xpPointsEl.textContent = data.xp_points.toLocaleString();
        if (sunBalanceEl) sunBalanceEl.textContent = data.sun_balance.toLocaleString();
        if (headerStreakEl) headerStreakEl.textContent = `${data.streak_days}/7 days`;

        // Atualizar barras de progresso
        if (streakProgressEl) streakProgressEl.style.width = `${streakProgress}%`;
        if (xpProgressEl) xpProgressEl.style.width = `${xpProgress}%`;
        if (userLevelEl) userLevelEl.textContent = `Level ${level} • Next level at ${xpForNextLevel} XP`;

    } catch (error) {
        console.error('Error loading user data:', error);
        showNotification('Failed to load user data.', 'error');
    }
}

async function loadUserMissions() {
    if (!missionsContainer || !currentUser) return;

    try {
        const { data, error } = await supabase
            .from('user_missions')
            .select(`
                id,
                progress, 
                completed,
                reward_claimed,
                mission_id (id, name, description, reward_sun, reward_xp, max_progress)
            `)
            .eq('user_id', currentUser.id);

        if (error) throw error;

        missionsContainer.innerHTML = '';

        data.forEach(item => {
            const mission = item.mission_id;
            const progressPercent = mission.max_progress > 0
                ? (item.progress / mission.max_progress) * 100
                : 0;

            // Determinar estado do botão
            let buttonText, buttonClass, isDisabled;
            if (item.reward_claimed) {
                buttonText = 'Claimed';
                buttonClass = 'bg-gray-800 text-gray-500 cursor-not-allowed';
                isDisabled = true;
            } else if (item.completed) {
                buttonText = 'Claim Reward';
                buttonClass = 'bg-solar hover:bg-solar-dark text-gray-900';
                isDisabled = false;
            } else {
                buttonText = 'Execute Mission';
                buttonClass = 'bg-gray-800 hover:bg-gray-700 text-solar';
                isDisabled = false;
            }

            const missionCard = document.createElement('div');
            missionCard.className = 'glass-panel card-hover p-6 relative overflow-hidden';
            missionCard.innerHTML = `
                <div class="hologram-effect"></div>
                <div class="flex justify-between items-start">
                    <div class="text-3xl">${getMissionIcon(mission.name)}</div>
                    <div class="bg-solar text-gray-900 text-xs font-bold px-2 py-1 rounded">
                        +${mission.reward_sun} SUN • +${mission.reward_xp} XP
                    </div>
                </div>
                <h3 class="font-bold text-lg mt-3">${mission.name}</h3>
                <p class="text-gray-400 text-sm mt-1">${mission.description}</p>
                
                <div class="mt-4">
                    <div class="w-full bg-gray-800 rounded-full h-2">
                        <div class="progress-gradient h-2 rounded-full" style="width: ${progressPercent}%"></div>
                    </div>
                    <div class="flex justify-between text-xs mt-1">
                        <span>Progress: ${item.progress}/${mission.max_progress}</span>
                        <span>${item.completed ? 'Completed' : Math.round(progressPercent)}%</span>
                    </div>
                </div>
                
                <button class="w-full mt-6 font-bold py-3 rounded-lg transition hover:shadow-glow mission-button ${buttonClass}"
                data-mission-id="${mission.id}"
                data-user-mission-id="${item.id}"
                ${isDisabled ? 'disabled' : ''}>
                    ${buttonText}
                </button>
            `;

            missionsContainer.appendChild(missionCard);
        });

        // Adicionar event listeners apenas aos botões habilitados
        document.querySelectorAll('.mission-button:not([disabled])').forEach(button => {
            button.addEventListener('click', handleMissionAction);
        });

    } catch (error) {
        console.error('Error loading missions:', error);
        showNotification('Failed to load missions.', 'error');
    }
}
// Ícones para missões
function getMissionIcon(missionName) {
    const icons = {
        'Daily Check-in': '📱',
        'Referral Pioneer': '👥',
        'Community Engagement': '💬',
        'Social Media Share': '📢',
        'Wallet Connection': '🔗'
    };
    return icons[missionName] || '🎯';
}

// Carregar conquistas do usuário
async function loadUserAchievements() {
    if (!achievementsContainer || !currentUser) return;

    try {
        const { data: achievements, error: achievementsError } = await supabase
            .from('achievements')
            .select('*');

        if (achievementsError) throw achievementsError;

        const { data: userAchievements, error: userAchievementsError } = await supabase
            .from('user_achievements')
            .select('achievement_id, unlocked_at')
            .eq('user_id', currentUser.id);

        if (userAchievementsError) throw userAchievementsError;

        achievementsContainer.innerHTML = '';

        achievements.forEach(achievement => {
            const userAchievement = userAchievements.find(ua => ua.achievement_id === achievement.id);
            const unlocked = !!userAchievement;
            const unlockDate = unlocked
                ? new Date(userAchievement.unlocked_at).toLocaleDateString()
                : '';

            const achievementCard = document.createElement('div');
            achievementCard.className = 'group relative';
            achievementCard.innerHTML = `
                <div class="glass-panel p-4 flex flex-col items-center ${unlocked ? '' : 'locked-badge'}">
                    <div class="text-4xl mb-2">${achievement.icon}</div>
                    <h3 class="text-center text-sm font-bold">${achievement.name}</h3>
                    <div class="absolute top-2 right-2 ${unlocked ? 'text-yellow-500' : 'text-gray-500'}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="${unlocked
                    ? 'M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                    : 'M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z'
                }" clip-rule="evenodd" />
                        </svg>
                    </div>
                </div>
                <div class="absolute inset-0 bg-black bg-opacity-80 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition pointer-events-none">
                    <div class="text-center p-2 text-xs">
                        ${unlocked ? `Unlocked on ${unlockDate}` : achievement.description}
                    </div>
                </div>
            `;

            achievementsContainer.appendChild(achievementCard);
        });

    } catch (error) {
        console.error('Error loading achievements:', error);
        showNotification('Failed to load achievements.', 'error');
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
            // Verificar se wallet_address existe antes de usar slice
            const walletAddress = user.wallet_address || '';
            const shortAddress = walletAddress
                ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                : 'Unknown';

            const level = calculateLevel(user.xp_points);
            const xpPercent = (user.xp_points % 1000) / 10;

            const rankCard = document.createElement('div');
            rankCard.className = `glass-panel leaderboard-card p-4 flex items-center relative ${index === 0 ? 'border border-solar rounded-xl' : ''
                }`;

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

    // Desabilita o botão e muda o texto
    checkinButton.disabled = true;
    checkinButton.textContent = 'Processing...';

    showLoading();
    try {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // Verificar se já fez check-in hoje
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

        // Registrar novo check-in
        const { error: insertError } = await supabase
            .from('checkins')
            .insert([{
                user_id: currentUser.id,
                checkin_date: todayStr
            }]);

        if (insertError) throw insertError;

        // Calcular novo streak
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const { data: yesterdayCheckin } = await supabase
            .from('checkins')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('checkin_date', yesterdayStr);

        const newStreak = yesterdayCheckin.length > 0 ? currentUser.streak_days + 1 : 1;

        // Calcular XP com multiplicador baseado no streak
        const baseXP = 10;
        const xpMultiplier = 1 + Math.floor(newStreak / 3) * 0.5; // +50% a cada 3 dias
        const xpEarned = Math.round(baseXP * xpMultiplier);

        // Atualizar usuário
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

        // Recarregar dados
        await loadUserData(currentUser.id);
        showNotification(`Daily check-in successful! +${xpEarned} XP +5 SUN`, 'success');

    } catch (error) {
        console.error('Check-in error:', error);
        showNotification('Error processing check-in', 'error');
    } finally {
        hideLoading();
        // Reabilita o botão e restaura o texto
        checkinButton.disabled = false;

        // Atualizar o estado do botão
        startCheckinTimer();
    }
}
// Adicione esta função para validar o referral
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

    // Verificar se os elementos existem
    if (!input || !button) return;

    const code = input.value.trim().toUpperCase();

    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Applying...';
    showLoading();

    try {
        // Validações
        const validationError = validateReferralCode(code);
        if (validationError) {
            throw new Error(validationError);
        }

        // Verificar se o código existe
        const { data: referralOwner, error: findError } = await supabase
            .from('users')
            .select('id, referral_count')
            .eq('referral_code', code)
            .single();

        if (findError || !referralOwner) {
            throw new Error('Invalid referral code or not found');
        }

        // Atualizar o usuário atual
        const { error: updateError } = await supabase
            .from('users')
            .update({ referred_by: code })
            .eq('id', currentUser.id);

        if (updateError) throw updateError;

        // CORREÇÃO AQUI: Atualizar usando o valor atual + 1
        const { error: countUpdateError } = await supabase
            .from('users')
            .update({ referral_count: referralOwner.referral_count + 1 })
            .eq('id', referralOwner.id);

        if (countUpdateError) throw countUpdateError;

        showNotification('Referral code applied successfully!');
        input.value = '';
        // ATUALIZAR MISSÃO DO DONO DO CÓDIGO
        if (referralOwner) {
            // Atualizar contagem
            const newCount = (referralOwner.referral_count || 0) + 1;

            await supabase
                .from('users')
                .update({ referral_count: newCount })
                .eq('id', referralOwner.id);

            // Forçar atualização da missão
            const tempUser = currentUser;
            currentUser = { ...referralOwner, referral_count: newCount };
            await updateReferralMissionProgress();
            currentUser = tempUser;
        }
        // Recarregar dados
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

// Modifique a função generateReferralCode
async function generateReferralCode() {
    const button = document.getElementById('generate-referral');

    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Gerando...';
    showLoading();

    try {
        // Gerar código único
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

        if (!isUnique) {
            throw new Error('Não foi possível gerar um código único. Tente novamente.');
        }

        // Atualizar usuário
        const { error } = await supabase
            .from('users')
            .update({ referral_code: referralCode })
            .eq('id', currentUser.id);

        if (error) throw error;

        currentUser.referral_code = referralCode;
        showNotification('Código referral gerado com sucesso!');

        await updateReferralMissionProgress();

        await loadReferralData();

    } catch (error) {
        console.error('Erro ao gerar código referral:', error);
        showNotification(error.message || 'Falha ao gerar código referral', 'error');
        button.disabled = false;
        button.textContent = originalText;
    } finally {
        hideLoading();
    }
}

// Adicione suporte para cópia de código
function setupCopyButton() {
    document.getElementById('referral-code-container').addEventListener('click', (e) => {
        if (e.target.id === 'copy-referral') {
            navigator.clipboard.writeText(currentUser.referral_code);
            showNotification('Código copiado para a área de transferência!');

            // Feedback visual
            e.target.textContent = 'Copiado!';
            setTimeout(() => {
                e.target.textContent = 'Copy';
            }, 2000);
        }
    });
}

async function loadReferralData() {
    if (!currentUser) return;

    try {
        // Atualizar contagem
        const referralCountEl = document.getElementById('referral-count');
        if (referralCountEl) {
            referralCountEl.textContent = currentUser.referral_count || 0;
        }
        await updateReferralMissionProgress();
        // Configurar eventos dinamicamente
        const generateBtn = document.getElementById('generate-referral');
        const copyBtn = document.getElementById('copy-referral');
        const submitBtn = document.getElementById('submit-referral');
        const referralInput = document.getElementById('referral-input');

        // Remover event listeners antigos para evitar duplicação
        if (generateBtn) generateBtn.onclick = null;
        if (copyBtn) copyBtn.onclick = null;
        if (submitBtn) submitBtn.onclick = null;
        if (referralInput) referralInput.onkeypress = null;

        if (currentUser.referred_by) {
            // Usuário JÁ usou um referral
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

            // Configurar próprio código do usuário
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

                // Configurar evento de cópia
                const newCopyBtn = document.getElementById('copy-referral');
                if (newCopyBtn) {
                    newCopyBtn.addEventListener('click', () => {
                        navigator.clipboard.writeText(currentUser.referral_code);
                        showNotification('Copied to clipboard!');
                        newCopyBtn.textContent = 'Copied!';
                        setTimeout(() => {
                            if (newCopyBtn) newCopyBtn.textContent = 'Copy';
                        }, 2000);
                    });
                }
            }
        } else {
            // Usuário ainda NÃO usou um referral
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

            // Configurar próprio código do usuário
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

            // Configurar eventos dinamicamente
            setTimeout(() => {
                const newGenerateBtn = document.getElementById('generate-referral');
                const newCopyBtn = document.getElementById('copy-referral');
                const newSubmitBtn = document.getElementById('submit-referral');
                const newReferralInput = document.getElementById('referral-input');

                if (newGenerateBtn) {
                    newGenerateBtn.addEventListener('click', generateReferralCode);
                }

                if (newCopyBtn) {
                    newCopyBtn.addEventListener('click', () => {
                        navigator.clipboard.writeText(currentUser.referral_code);
                        showNotification('Copied to clipboard!');
                        newCopyBtn.textContent = 'Copied!';
                        setTimeout(() => {
                            if (newCopyBtn) newCopyBtn.textContent = 'Copy';
                        }, 2000);
                    });
                }

                if (newSubmitBtn) {
                    newSubmitBtn.addEventListener('click', applyReferralCode);
                }

                if (newReferralInput) {
                    newReferralInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            applyReferralCode();
                        }
                    });
                }
            }, 100);
        }

    } catch (error) {
        console.error('Error loading referral data:', error);
        showNotification('Failed to load referral data.', 'error');
    }
}
// Handlers específicos para cada missão
const missionHandlers = {
    // Missão de Daily Check-in (ID 1)
    1: {
        execute: async (userMission) => {
            // Executar o check-in diário
            await handleDailyCheckin();

            // Atualizar progresso da missão
            const newProgress = 1;
            await updateMissionProgress(userMission.id, newProgress);

            return newProgress;
        },
        claim: async (userMission) => {
            // Reivindicar recompensa
            await claimMissionReward(userMission);
        }
    },

    // Missão de Referral Pioneer (ID 2)
    2: {
        execute: async (userMission) => {
            // Não há ação direta, o progresso é automático
            showNotification("Refer friends to complete this mission!");
            return userMission.progress;
        },
        claim: async (userMission) => {
            // Reivindicar recompensa
            await claimMissionReward(userMission);
        }
    },

    // Handler padrão para outras missões
    default: {
        execute: async (userMission) => {
            // Lógica padrão: incrementar progresso
            const newProgress = userMission.progress + 1;
            await updateMissionProgress(userMission.id, newProgress);
            return newProgress;
        },
        claim: async (userMission) => {
            await claimMissionReward(userMission);
        }
    }
};

// Obter handler para uma missão específica
function getMissionHandler(missionId) {
    return missionHandlers[missionId] || missionHandlers.default;
}
// Manipular ações de missão
async function handleMissionAction(event) {
    const button = event.currentTarget;
    const missionId = parseInt(button.dataset.missionId);
    const userMissionId = parseInt(button.dataset.userMissionId);

    if (!missionId || !userMissionId || !currentUser) return;

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Processing...';

    showLoading();
    try {
        // Verificar progresso atual
        const { data: missionData, error } = await supabase
            .from('user_missions')
            .select('*, mission_id (*)')
            .eq('id', userMissionId)
            .single();

        if (error) throw error;
         if (missionData.reward_claimed) {
            showNotification('You already claimed this reward!', 'info');
            return;
        }
        // Obter handler específico para esta missão
        const handler = getMissionHandler(missionId);

        if (missionData.completed) {
            // Reivindicar recompensa
            await handler.claim(missionData);
        } else {
            // Executar ação da missão
            const newProgress = await handler.execute(missionData);

            // Verificar se a missão foi completada
            if (newProgress >= missionData.mission_id.max_progress) {
                // Atualizar missão como completada
                await supabase
                    .from('user_missions')
                    .update({
                        completed: true,
                        completed_at: new Date().toISOString()
                    })
                    .eq('id', userMissionId);
            }
        }

        // Recarregar dados
        await loadUserData(currentUser.id);
        await loadUserMissions();

    } catch (error) {
        console.error('Mission action error:', error);
        button.textContent = 'Error - Try Again';
        showNotification('Failed to complete mission.', 'error');
    } finally {
        hideLoading();
        setTimeout(() => {
            button.disabled = false;
            button.textContent = originalText;
        }, 2000);
    }
}
// Atualizar progresso de uma missão
async function updateMissionProgress(userMissionId, newProgress) {
    try {
        const { error } = await supabase
            .from('user_missions')
            .update({
                progress: newProgress,
                last_updated: new Date().toISOString()
            })
            .eq('id', userMissionId);

        if (error) throw error;

        return newProgress;
    } catch (error) {
        console.error('Error updating mission progress:', error);
        throw error;
    }
}

async function claimMissionReward(userMission) {
    try {
        // Verificar se a recompensa já foi reivindicada
        if (userMission.reward_claimed) {
            showNotification('Reward already claimed!', 'error');
            return;
        }

        // Obter detalhes da missão
        const mission = userMission.mission_id;

        // Atualizar recompensas do usuário
        const { error: userError } = await supabase
            .from('users')
            .update({
                sun_balance: currentUser.sun_balance + mission.reward_sun,
                xp_points: currentUser.xp_points + mission.reward_xp
            })
            .eq('id', currentUser.id);

        if (userError) throw userError;

        // Marcar recompensa como reivindicada
        const { error: missionError } = await supabase
            .from('user_missions')
            .update({
                reward_claimed: true
            })
            .eq('id', userMission.id);

        if (missionError) throw missionError;

        showNotification(`Mission reward claimed! +${mission.reward_sun} SUN +${mission.reward_xp} XP`);
    } catch (error) {
        console.error('Error claiming mission reward:', error);
        showNotification('Failed to claim reward.', 'error');
        throw error;
    }
}
async function updateReferralMissionProgress() {
    try {
        if (!currentUser) return;

        // Obter a missão de referral (ID 2)
        const { data: userMission, error } = await supabase
            .from('user_missions')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('mission_id', 2)
            .single();

        if (error || !userMission) return;

        // Atualizar progresso com base no referral_count
        const newProgress = currentUser.referral_count;
        const maxProgress = 3; // Definido na missão

        // Só atualiza se necessário
        if (newProgress > userMission.progress) {
            const { error: updateError } = await supabase
                .from('user_missions')
                .update({
                    progress: newProgress,
                    completed: newProgress >= maxProgress,
                    completed_at: newProgress >= maxProgress ? new Date().toISOString() : null
                })
                .eq('id', userMission.id);

            if (updateError) throw updateError;

            // Recarregar missões se houve mudança
            if (newProgress > userMission.progress) {
                await loadUserMissions();
            }
        }
    } catch (error) {
        console.error('Error updating referral mission:', error);
    }
}