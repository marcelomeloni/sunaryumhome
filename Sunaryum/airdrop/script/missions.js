import { supabase, currentUser, showNotification, showLoading, hideLoading, calculateLevel } from './main.js';

// Elementos da UI
const missionsContainer = document.getElementById('missions-container');
const achievementsContainer = document.getElementById('achievements-container');
const missionTabs = document.getElementById('mission-tabs');
const activeMissionsBtn = document.getElementById('active-missions');
const completedMissionsBtn = document.getElementById('completed-missions');

// Ícones para missões
export function getMissionIcon(missionName) {
    const icons = {
        'Referral Pioneer': '👥',
        'Community Engagement': '💬',
        'Social Media Share': '📢',
        'Wallet Connection': '🔗',
        'Daily Check-in': '🔥',
        'Discord Verification': '🟣'
    };
    return icons[missionName] || '🎯';
}

// Inicializar missões do usuário
export async function initializeUserMissions(userId) {
    try {
        const { data: existingMissions, error: countError } = await supabase
            .from('user_missions')
            .select('id', { count: 'exact' })
            .eq('user_id', userId);

        if (countError) throw countError;
        if (existingMissions && existingMissions.length > 0) return;

        const { data: allMissions, error: missionsError } = await supabase
            .from('missions')
            .select('id');

        if (missionsError) throw missionsError;

        const missionsToCreate = allMissions.map(mission => ({
            user_id: userId,
            mission_id: mission.id,
            progress: 0,
            completed: false
        }));

        const { error: insertError } = await supabase
            .from('user_missions')
            .insert(missionsToCreate);

        if (insertError) throw insertError;

    } catch (error) {
        console.error('Error initializing user missions:', error);
        showNotification('Failed to initialize missions.', 'error');
    }
}

// Carregar missões do usuário
export async function loadUserMissions() {
    if (!currentUser) return;

    try {
        showMissionSkeleton(true);
        
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

        // Separar missões ativas e completas
        const activeMissions = data.filter(m => !m.completed || !m.reward_claimed);
        const completedMissions = data.filter(m => m.completed && m.reward_claimed);

        // Renderizar missões ativas por padrão
        renderMissions(activeMissions, 'active');

        // Configurar abas
        setupMissionTabs(activeMissions, completedMissions);

    } catch (error) {
        console.error('Error loading missions:', error);
        showNotification('Failed to load missions.', 'error');
        showMissionSkeleton(false);
    }
}

// Mostrar esqueleto de carregamento
function showMissionSkeleton(show) {
    if (!show) {
        missionsContainer.innerHTML = '';
        return;
    }
    
    missionsContainer.innerHTML = `
        <div class="space-y-6">
            ${Array(3).fill().map(() => `
            <div class="glass-panel p-6 animate-pulse">
                <div class="flex justify-between">
                    <div class="w-8 h-8 rounded-full bg-gray-700"></div>
                    <div class="w-20 h-6 bg-gray-700 rounded"></div>
                </div>
                <div class="mt-4">
                    <div class="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                    <div class="h-3 bg-gray-700 rounded w-full mb-1"></div>
                    <div class="h-3 bg-gray-700 rounded w-5/6"></div>
                </div>
                <div class="mt-4">
                    <div class="w-full bg-gray-800 rounded-full h-2"></div>
                    <div class="flex justify-between mt-1">
                        <div class="h-3 w-16 bg-gray-700 rounded"></div>
                        <div class="h-3 w-10 bg-gray-700 rounded"></div>
                    </div>
                </div>
                <div class="mt-4 h-12 bg-gray-800 rounded-lg"></div>
            </div>
            `).join('')}
        </div>
    `;
}

// Configurar abas de missões
function setupMissionTabs(activeMissions, completedMissions) {
    if (!missionTabs) return;
    
    missionTabs.classList.remove('hidden');
    activeMissionsBtn.textContent = `Active (${activeMissions.length})`;
    completedMissionsBtn.textContent = `Completed (${completedMissions.length})`;
    
    activeMissionsBtn.addEventListener('click', () => {
        activeMissionsBtn.classList.add('active', 'border-b-2', 'border-solar', 'text-solar');
        completedMissionsBtn.classList.remove('active', 'border-b-2', 'border-solar', 'text-solar');
        renderMissions(activeMissions, 'active');
    });
    
    completedMissionsBtn.addEventListener('click', () => {
        completedMissionsBtn.classList.add('active', 'border-b-2', 'border-solar', 'text-solar');
        activeMissionsBtn.classList.remove('active', 'border-b-2', 'border-solar', 'text-solar');
        renderMissions(completedMissions, 'completed');
    });
}

// Renderizar missões
function renderMissions(missions, type) {
    missionsContainer.innerHTML = '';
    
    if (missions.length === 0) {
        missionsContainer.innerHTML = `
            <div class="text-center py-12">
                <div class="text-5xl mb-4">📭</div>
                <h3 class="text-xl font-bold">No ${type} missions</h3>
                <p class="text-gray-400 mt-2">
                    ${type === 'active' 
                        ? 'Complete missions to earn rewards!' 
                        : 'Complete more missions to fill this section!'}
                </p>
            </div>
        `;
        return;
    }
    
    missions.forEach(item => {
        const mission = item.mission_id;
        const progressPercent = mission.max_progress > 0
            ? (item.progress / mission.max_progress) * 100
            : 0;
            
        const isClaimed = item.reward_claimed;
        const isCompleted = item.completed;
        const isInProgress = !isCompleted && item.progress > 0;

        let statusBadge = '';
        if (isClaimed) {
            statusBadge = '<span class="bg-green-900 text-green-300 text-xs px-2 py-1 rounded-full ml-2">Claimed</span>';
        } else if (isCompleted) {
            statusBadge = '<span class="bg-yellow-900 text-yellow-300 text-xs px-2 py-1 rounded-full ml-2">Reward Ready</span>';
        } else if (isInProgress) {
            statusBadge = '<span class="bg-blue-900 text-blue-300 text-xs px-2 py-1 rounded-full ml-2">In Progress</span>';
        }

        const missionCard = document.createElement('div');
        missionCard.className = 'glass-panel card-hover p-6 relative overflow-hidden transition-transform duration-300 hover:-translate-y-1';
        missionCard.innerHTML = `
            <div class="hologram-effect"></div>
            <div class="flex justify-between items-start">
                <div class="text-3xl">${getMissionIcon(mission.name)}</div>
                <div class="flex items-center">
                    <div class="bg-solar text-gray-900 text-xs font-bold px-2 py-1 rounded">
                        +${mission.reward_sun} SUN • +${mission.reward_xp} XP
                    </div>
                    ${statusBadge}
                </div>
            </div>
            <h3 class="font-bold text-lg mt-3 flex items-center">
                ${mission.name}
            </h3>
            <p class="text-gray-400 text-sm mt-1">${mission.description}</p>
            
            <div class="mt-4">
                <div class="w-full bg-gray-800 rounded-full h-2">
                    <div class="progress-gradient h-2 rounded-full" style="width: ${progressPercent}%"></div>
                </div>
                <div class="flex justify-between text-xs mt-1">
                    <span>Progress: ${item.progress}/${mission.max_progress}</span>
                    <span>${isCompleted ? 'Completed' : Math.round(progressPercent)}%</span>
                </div>
            </div>
            
            <button class="w-full mt-6 font-bold py-3 rounded-lg transition-all duration-300 hover:shadow-glow mission-button 
                ${isClaimed ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 
                   isCompleted ? 'bg-solar hover:bg-solar-dark text-gray-900' : 
                   'bg-gray-800 hover:bg-gray-700 text-solar'}"
                data-mission-id="${mission.id}"
                data-user-mission-id="${item.id}"
                ${isClaimed ? 'disabled' : ''}>
                ${isClaimed ? 'Reward Claimed' : 
                  isCompleted ? 'Claim Reward' : 
                  'Execute Mission'}
            </button>
        `;

        missionsContainer.appendChild(missionCard);
    });

    document.querySelectorAll('.mission-button:not([disabled])').forEach(button => {
        button.addEventListener('click', handleMissionAction);
    });
}

// Carregar conquistas do usuário
export async function loadUserAchievements() {
    if (!currentUser) return;

    try {
        achievementsContainer.innerHTML = Array(6).fill().map(() => `
            <div class="glass-panel p-4 flex flex-col items-center animate-pulse">
                <div class="w-12 h-12 bg-gray-700 rounded-full mb-2"></div>
                <div class="h-4 w-16 bg-gray-700 rounded"></div>
            </div>
        `).join('');
        
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
            achievementCard.className = 'group relative transform transition-transform duration-300 hover:scale-105';
            achievementCard.innerHTML = `
                <div class="glass-panel p-4 flex flex-col items-center ${unlocked ? 'badge-glow' : 'opacity-60'}" 
                     style="min-height: 140px; display: flex; flex-direction: column; justify-content: center;">
                    <div class="text-4xl mb-2 transition-transform duration-300 group-hover:scale-125">${achievement.icon}</div>
                    <h3 class="text-center text-sm font-bold">${achievement.name}</h3>
                    <div class="absolute top-2 right-2 ${unlocked ? 'text-yellow-500' : 'text-gray-500'}">
                        ${unlocked ? '✅' : '🔒'}
                    </div>
                </div>
                <div class="absolute inset-0 bg-black bg-opacity-90 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition pointer-events-none p-3">
                    <div class="text-center text-sm">
                        ${unlocked ? 
                            `<div class="text-green-400 font-bold">Unlocked!</div>
                             <div class="text-xs mt-1">${unlockDate}</div>` : 
                            achievement.description}
                    </div>
                </div>
            `;

            achievementsContainer.appendChild(achievementCard);
        });

    } catch (error) {
        console.error('Error loading achievements:', error);
        showNotification('Failed to load achievements.', 'error');
        achievementsContainer.innerHTML = '<p class="text-center py-4 text-gray-500">Failed to load achievements</p>';
    }
}

// Handlers específicos para cada missão
const missionHandlers = {
    1: { // Daily Check-in
        execute: async (userMission) => {
            await handleDailyCheckin();
            return 1; // Progresso é sempre 1 para check-in diário
        },
        claim: async (userMission) => {
            await claimMissionReward(userMission);
        }
    },
    2: { // Referral Pioneer
        execute: async (userMission) => {
            showNotification("Share your referral code to complete this mission!", 'info');
            return userMission.progress;
        },
        claim: async (userMission) => {
            await claimMissionReward(userMission);
        }
    },
    3: { // Discord Verification
        execute: async (userMission) => {
            // Abre o Discord no canal de verificação
            window.open('https://discord.com/channels/1386408258134343761/1398404747924607106', '_blank');
            
            // Mostra instruções para o usuário
            showNotification('Send your wallet address in #verify channel to complete this mission', 'info');
            
            // Inicia a verificação periódica
            startDiscordVerification();
            
            return userMission.progress;
        },
        claim: async (userMission) => {
            await claimMissionReward(userMission);
        }
    },
    4: { // Wallet Connection
        execute: async (userMission) => {
            showNotification("Wallet connection mission executed!", 'success');
            const newProgress = userMission.progress + 1;
            await updateMissionProgress(userMission.id, newProgress);
            return newProgress;
        },
        claim: async (userMission) => {
            await claimMissionReward(userMission);
        }
    },
    default: {
        execute: async (userMission) => {
            const newProgress = userMission.progress + 1;
            await updateMissionProgress(userMission.id, newProgress);
            return newProgress;
        },
        claim: async (userMission) => {
            await claimMissionReward(userMission);
        }
    }
};

let discordVerificationInterval = null;

// Função para iniciar a verificação periódica
export function startDiscordVerification() {
    if (discordVerificationInterval) clearInterval(discordVerificationInterval);
    
    // Mostrar status de verificação em andamento
    showNotification('Checking Discord verification status...', 'info');
    
    discordVerificationInterval = setInterval(async () => {
        if (!currentUser) return;
        
        const isVerified = await checkDiscordVerification(currentUser.wallet_address);
        
        if (isVerified) {
            clearInterval(discordVerificationInterval);
            discordVerificationInterval = null;
            await updateDiscordMission();
            showNotification('Discord verification successful! Mission completed.', 'success');
        } else {
            showNotification('Still waiting for Discord verification...', 'info');
        }
    }, 30000); // Verifica a cada 30 segundos
}

// Função para verificar no backend
async function checkDiscordVerification(walletAddress) {
    try {
        const response = await fetch(
            `https://airdrop-sunaryum.onrender.com/api/check-discord-verification?wallet=${encodeURIComponent(walletAddress)}`
        );
        
        const data = await response.json();
        return data.verified;
    } catch (error) {
        console.error('Verification check failed:', error);
        return false;
    }
}

// Atualiza a missão do Discord
async function updateDiscordMission() {
    try {
        // Busca a missão do Discord
        const { data: userMission, error } = await supabase
            .from('user_missions')
            .select('id, progress')
            .eq('user_id', currentUser.id)
            .eq('mission_id', 3)
            .single();

        if (error || !userMission) return;

        // Atualiza para completo
        await updateMissionProgress(userMission.id, 1);
        
        // Atualiza apenas a missão alterada
        await updateSingleMission(userMission.id);
    } catch (error) {
        console.error('Error updating Discord mission:', error);
    }
}

// Obter handler para uma missão
function getMissionHandler(missionId) {
    return missionHandlers[missionId] || missionHandlers.default;
}

// Manipular ações de missão
export async function handleMissionAction(event) {
    const button = event.currentTarget;
    const missionId = parseInt(button.dataset.missionId);
    const userMissionId = parseInt(button.dataset.userMissionId);

    if (!missionId || !userMissionId || !currentUser) return;

    const originalText = button.textContent;
    button.disabled = true;
    button.innerHTML = `
        <div class="inline-flex items-center">
            <span class="animate-spin mr-2">🔄</span>
            Processing...
        </div>
    `;

    showLoading();
    try {
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

        const handler = getMissionHandler(missionId);

        if (missionData.completed) {
            await handler.claim(missionData);
            showNotification(`Mission reward claimed! +${missionData.mission_id.reward_sun} SUN +${missionData.mission_id.reward_xp} XP`, 'success');
        } else {
            const newProgress = await handler.execute(missionData);
            
            if (newProgress >= missionData.mission_id.max_progress) {
                await supabase
                    .from('user_missions')
                    .update({
                        completed: true,
                        completed_at: new Date().toISOString()
                    })
                    .eq('id', userMissionId);
                
                showNotification('Mission completed! Claim your reward.', 'success');
            } else {
                showNotification('Mission progress updated!', 'info');
            }
        }

        // Atualiza apenas a missão alterada
        await updateSingleMission(userMissionId);

    } catch (error) {
        console.error('Mission action error:', error);
        button.innerHTML = '<span class="text-red-500">Error - Try Again</span>';
        showNotification('Failed to complete mission: ' + error.message, 'error');
    } finally {
        hideLoading();
        setTimeout(() => {
            button.disabled = false;
            button.textContent = originalText;
        }, 3000);
    }
}

// Atualizar apenas uma missão específica
async function updateSingleMission(userMissionId) {
    try {
        const { data: missionData, error } = await supabase
            .from('user_missions')
            .select('*, mission_id (*)')
            .eq('id', userMissionId)
            .single();

        if (error || !missionData) return;

        // Encontrar o cartão de missão existente
        const missionCard = document.querySelector(`.mission-button[data-user-mission-id="${userMissionId}"]`)?.closest('.glass-panel');
        
        if (missionCard) {
            // Recriar o cartão com dados atualizados
            const progressPercent = missionData.mission_id.max_progress > 0
                ? (missionData.progress / missionData.mission_id.max_progress) * 100
                : 0;
                
            const isClaimed = missionData.reward_claimed;
            const isCompleted = missionData.completed;
            const isInProgress = !isCompleted && missionData.progress > 0;

            let statusBadge = '';
            if (isClaimed) {
                statusBadge = '<span class="bg-green-900 text-green-300 text-xs px-2 py-1 rounded-full ml-2">Claimed</span>';
            } else if (isCompleted) {
                statusBadge = '<span class="bg-yellow-900 text-yellow-300 text-xs px-2 py-1 rounded-full ml-2">Reward Ready</span>';
            } else if (isInProgress) {
                statusBadge = '<span class="bg-blue-900 text-blue-300 text-xs px-2 py-1 rounded-full ml-2">In Progress</span>';
            }

            missionCard.innerHTML = `
                <div class="hologram-effect"></div>
                <div class="flex justify-between items-start">
                    <div class="text-3xl">${getMissionIcon(missionData.mission_id.name)}</div>
                    <div class="flex items-center">
                        <div class="bg-solar text-gray-900 text-xs font-bold px-2 py-1 rounded">
                            +${missionData.mission_id.reward_sun} SUN • +${missionData.mission_id.reward_xp} XP
                        </div>
                        ${statusBadge}
                    </div>
                </div>
                <h3 class="font-bold text-lg mt-3 flex items-center">
                    ${missionData.mission_id.name}
                </h3>
                <p class="text-gray-400 text-sm mt-1">${missionData.mission_id.description}</p>
                
                <div class="mt-4">
                    <div class="w-full bg-gray-800 rounded-full h-2">
                        <div class="progress-gradient h-2 rounded-full" style="width: ${progressPercent}%"></div>
                    </div>
                    <div class="flex justify-between text-xs mt-1">
                        <span>Progress: ${missionData.progress}/${missionData.mission_id.max_progress}</span>
                        <span>${isCompleted ? 'Completed' : Math.round(progressPercent)}%</span>
                    </div>
                </div>
                
                <button class="w-full mt-6 font-bold py-3 rounded-lg transition-all duration-300 hover:shadow-glow mission-button 
                    ${isClaimed ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 
                       isCompleted ? 'bg-solar hover:bg-solar-dark text-gray-900' : 
                       'bg-gray-800 hover:bg-gray-700 text-solar'}"
                    data-mission-id="${missionData.mission_id.id}"
                    data-user-mission-id="${missionData.id}"
                    ${isClaimed ? 'disabled' : ''}>
                    ${isClaimed ? 'Reward Claimed' : 
                      isCompleted ? 'Claim Reward' : 
                      'Execute Mission'}
                </button>
            `;

            // Reatribuir o event listener
            const newButton = missionCard.querySelector('.mission-button:not([disabled])');
            if (newButton) {
                newButton.addEventListener('click', handleMissionAction);
            }
        }

    } catch (error) {
        console.error('Error updating single mission:', error);
    }
}

// Atualizar progresso de uma missão
export async function updateMissionProgress(userMissionId, newProgress) {
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

// Reivindicar recompensa da missão
export async function claimMissionReward(userMission) {
    try {
        if (userMission.reward_claimed) {
            showNotification('Reward already claimed!', 'error');
            return;
        }

        const mission = userMission.mission_id;
        const { error: userError } = await supabase
            .from('users')
            .update({
                sun_balance: currentUser.sun_balance + mission.reward_sun,
                xp_points: currentUser.xp_points + mission.reward_xp
            })
            .eq('id', currentUser.id);

        if (userError) throw userError;

        const { error: missionError } = await supabase
            .from('user_missions')
            .update({
                reward_claimed: true
            })
            .eq('id', userMission.id);

        if (missionError) throw missionError;

    } catch (error) {
        console.error('Error claiming mission reward:', error);
        throw error;
    }
}

// Atualizar progresso da missão de referral
export async function updateReferralMissionProgress() {
    try {
        if (!currentUser) return;

        const { data: userMission, error } = await supabase
            .from('user_missions')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('mission_id', 2)
            .single();

        if (error || !userMission) return;

        const newProgress = currentUser.referral_count;
        const maxProgress = 3;

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
            
            // Atualiza apenas esta missão
            await updateSingleMission(userMission.id);
        }
    } catch (error) {
        console.error('Error updating referral mission:', error);
    }
}