// ========== App Router ==========

const App = {
    currentRoute: '',
    data: {},
    mediaRecorder: null,
    audioChunks: [],
    isRecording: false,
    currentRecordingLang: 'en', // track which language we're recording for
    speechSupported: !!(window.SpeechRecognition || window.webkitSpeechRecognition),

    init() {
        this.route();
        window.addEventListener('popstate', () => this.route());
    },

    route() {
        const path = window.location.pathname;
        const app = document.getElementById('app');

        if (path === '/' || path === '') {
            this.renderHome(app);
        } else if (path.match(/^\/play\/\d+$/)) {
            const playId = parseInt(path.split('/').pop());
            this.renderPlay(app, playId);
        } else if (path.match(/^\/watch\/\d+$/)) {
            const playId = parseInt(path.split('/').pop());
            this.renderWatch(app, playId);
        } else if (path.match(/^\/practice\/\d+\/.+$/)) {
            const parts = path.split('/').filter(Boolean);
            const playId = parseInt(parts[1]);
            const characterId = parts[2];
            this.renderPractice(app, playId, characterId);
        } else {
            app.innerHTML = '<div class="empty-state"><div class="emoji">🤷</div><p>Page not found</p></div>';
        }
    },

    navigate(path) {
        history.pushState(null, '', path);
        this.route();
        window.scrollTo(0, 0);
    },

    // ========== Home Page ==========
    async renderHome(container) {
        container.innerHTML = '<div class="empty-state"><div class="emoji">🎭</div><p>Loading plays...</p></div>';
        try {
            const res = await fetch('/api/plays');
            const plays = await res.json();
            let html = `
                <h1 class="page-title">🎭 Bilingual Playhouse</h1>
                <p class="page-subtitle">Choose a story and start your bilingual adventure! 选择一个故事，开始你的双语冒险！</p>
                <div class="play-cards">
            `;
            for (const play of plays) {
                const charCount = play.characters.length;
                const sceneCount = play.scenes.length - 1;
                html += `
                    <div class="play-card" onclick="App.navigate('/play/${play.id}')">
                        <div class="play-card-header">
                            <span class="play-card-emoji">${play.cover_emoji}</span>
                            <div>
                                <div class="play-card-title">${play.title_en}</div>
                                <div class="play-card-title-zh">${play.title_zh}</div>
                            </div>
                        </div>
                        <div class="play-card-desc">${play.description_en}<br><span style="color:var(--text-secondary)">${play.description_zh}</span></div>
                        <div class="play-card-meta">
                            <span class="meta-badge badge-scenes">${sceneCount} Scenes / 场景</span>
                            <span class="meta-badge badge-chars">${charCount} Characters / 角色</span>
                        </div>
                    </div>
                `;
            }
            html += '</div>';
            container.innerHTML = html;
        } catch (e) {
            container.innerHTML = '<div class="empty-state"><div class="emoji">😢</div><p>Failed to load plays</p></div>';
        }
    },

    // ========== Play Detail Page ==========
    async renderPlay(container, playId) {
        container.innerHTML = '<div class="empty-state"><div class="emoji">📖</div><p>Loading...</p></div>';
        try {
            const res = await fetch(`/api/play/${playId}`);
            const play = await res.json();
            this.data.play = play;
            this.data.lang = 'en';

            let html = `
                <a class="back-link" onclick="App.navigate('/')">← Back / 返回</a>
                <div class="play-header">
                    <div class="play-header-emoji">${play.cover_emoji}</div>
                    <div class="play-header-title" id="playTitle">${play.title_en}</div>
                    <div class="play-header-title-zh" id="playTitleZh">${play.title_zh}</div>
                </div>
                <div style="text-align:center;margin-bottom:16px">
                    <button class="btn btn-primary" onclick="App.navigate('/watch/${play.id}')" style="font-size:1.1rem;padding:12px 32px">🎬 Interactive Player / 互动播放器</button>
                </div>
                <div class="lang-toggle">
                    <button class="lang-btn active" id="btnEn" onclick="App.switchLang('en', ${playId})">🇬🇧 English</button>
                    <button class="lang-btn" id="btnZh" onclick="App.switchLang('zh', ${playId})">🇨🇳 中文</button>
                </div>
                <h2 class="section-title">👥 Characters / 角色</h2>
                <div class="characters-grid" id="charactersGrid">
                    ${this.renderCharacters(play, 'en')}
                </div>
                <h2 class="section-title">📜 Script / 剧本</h2>
                <div class="script-container" id="scriptContainer">
                    ${this.renderScript(play, 'en')}
                </div>
            `;
            container.innerHTML = html;
        } catch (e) {
            container.innerHTML = '<div class="empty-state"><div class="emoji">😢</div><p>Failed to load play</p></div>';
        }
    },

    renderCharacters(play, lang) {
        let html = '';
        for (const char of play.characters) {
            const name = char[`name_${lang}`] || char.name_en;
            const personality = char[`personality_${lang}`] || char.personality_en;
            const nameAlt = lang === 'en' ? char.name_zh : char.name_en;

            html += `<div class="char-card" style="border-left: 4px solid ${char.color}">
                <div class="char-card-header">
                    <span class="char-emoji">${char.emoji}</span>
                    <div>
                        <div class="char-name">${name}</div>
                        <div class="char-name-alt">${nameAlt}</div>
                    </div>
                </div>
                <div class="char-personality">${personality}</div>`;

            if (char.claimed_by) {
                html += `<div class="char-claimed">✅ ${lang === 'en' ? 'Claimed by' : '已认领'}: <span class="char-claimed-by">${char.claimed_by}</span></div>
                         <button class="unclaim-btn" onclick="App.unclaim('${char.claim_id}', ${play.id})">${lang === 'en' ? 'Release' : '释放角色'}</button>
                         <a class="btn btn-outline btn-sm" style="margin-top:8px" onclick="App.navigate('/practice/${play.id}/${char.id}')">${lang === 'en' ? '📖 Practice' : '📖 练习'}</a>`;
            } else {
                html += `<div class="claim-form">
                    <input class="claim-input" id="claim-${char.id}" placeholder="${lang === 'en' ? 'Your name' : '你的名字'}" onkeydown="if(event.key==='Enter')App.claim(${play.id},'${char.id}')">
                    <button class="claim-btn" onclick="App.claim(${play.id},'${char.id}')">${lang === 'en' ? 'Claim' : '认领'}</button>
                </div>`;
            }
            html += '</div>';
        }
        return html;
    },

    renderScript(play, lang) {
        let html = '';
        for (const scene of play.scenes) {
            const title = scene[`title_${lang}`] || scene.title_en;
            const stageDir = scene[`stage_direction_${lang}`] || scene.stage_direction_en;
            const isScene = scene.number > 0;
            html += `<div class="scene-block">
                <div class="scene-header" onclick="App.toggleScene(this)">
                    <span class="arrow">▼</span>
                    ${isScene ? `Scene ${scene.number}: ` : ''}${title}
                </div>`;
            if (stageDir) {
                html += `<div class="scene-stage-dir">(${stageDir})</div>`;
            }
            html += `<div class="scene-lines">`;
            for (const line of scene.lines) {
                const char = play.characters.find(c => c.id === line.character_id);
                const charName = char ? (char[`name_${lang}`] || char.name_en) : '';
                const charEmoji = char ? char.emoji : '';
                const text = line[`text_${lang}`] || line.text_en;
                const sd = line[`stage_direction_${lang}`] || line.stage_direction_en;
                if (line.is_chorus) {
                    html += `<div class="line-chorus">${charEmoji} ${text}</div>`;
                } else {
                    html += `<div class="line-row">
                        <div class="line-char" style="color:${char ? char.color : 'inherit'}">${charEmoji} ${charName}</div>
                        <div class="line-text">
                            ${sd ? `<span class="line-stage-dir">(${sd}) </span>` : ''}
                            ${text}
                        </div>
                    </div>`;
                }
            }
            html += '</div></div>';
        }
        return html;
    },

    toggleScene(header) {
        const lines = header.nextElementSibling?.nextElementSibling || header.nextElementSibling;
        if (lines && lines.classList.contains('scene-lines')) {
            lines.classList.toggle('hidden');
            const arrow = header.querySelector('.arrow');
            arrow.classList.toggle('collapsed');
        }
    },

    async switchLang(lang, playId) {
        this.data.lang = lang;
        const play = this.data.play;
        document.getElementById('btnEn').classList.toggle('active', lang === 'en');
        document.getElementById('btnZh').classList.toggle('active', lang === 'zh');
        document.getElementById('playTitle').textContent = play[`title_${lang}`] || play.title_en;
        document.getElementById('playTitleZh').textContent = lang === 'en' ? play.title_zh : play.title_en;
        document.getElementById('charactersGrid').innerHTML = this.renderCharacters(play, lang);
        document.getElementById('scriptContainer').innerHTML = this.renderScript(play, lang);
    },

    async claim(playId, characterId) {
        const input = document.getElementById(`claim-${characterId}`);
        const name = input.value.trim();
        if (!name) { input.focus(); return; }
        try {
            const res = await fetch('/api/claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ play_id: playId, character_id: characterId, player_name: name })
            });
            if (res.ok) {
                this.showToast('✅ Role claimed! / 角色已认领！', 'success');
                const playRes = await fetch(`/api/play/${playId}`);
                this.data.play = await playRes.json();
                this.switchLang(this.data.lang, playId);
            } else {
                const data = await res.json();
                this.showToast(`❌ ${data.error || 'Failed to claim'}`, 'error');
            }
        } catch (e) {
            this.showToast('❌ Network error', 'error');
        }
    },

    async unclaim(claimId, playId) {
        try {
            const res = await fetch('/api/unclaim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ claim_id: claimId })
            });
            if (res.ok) {
                this.showToast('🔄 Role released! / 角色已释放！', 'success');
                const playRes = await fetch(`/api/play/${playId}`);
                this.data.play = await playRes.json();
                this.switchLang(this.data.lang, playId);
            }
        } catch (e) {
            this.showToast('❌ Network error', 'error');
        }
    },

    // ========== Watch / Interactive Player Page ==========
    async renderWatch(container, playId) {
        container.innerHTML = '<div class="empty-state"><div class="emoji">🎬</div><p>Loading player...</p></div>';
        try {
            const res = await fetch(`/api/play/${playId}`);
            const play = await res.json();

            // Fetch reference audio recordings
            let refAudio = {};
            try {
                const refRes = await fetch(`/api/reference-audio/${playId}`);
                const refData = await refRes.json();
                // Build a lookup: "characterId|lineIndex|lang" -> file_path
                refData.forEach(r => {
                    const key = `${r.character_id}|${r.line_index}|${r.lang}`;
                    refAudio[key] = r.file_path;
                });
            } catch(e) { console.warn('Could not load reference audio:', e); }

            this.data.watch = {
                play,
                lang: 'en',
                mode: 'watch',        // 'watch' or 'practice'
                characterId: null,     // selected character for practice mode
                currentLineIdx: 0,
                isPlaying: false,
                isMuted: false,
                practiceStep: 'idle',  // 'idle' | 'ai-reading' | 'waiting-user' | 'user-reading' | 'scored'
                refAudio: refAudio     // reference audio lookup
            };

            // Flatten all lines with scene info for easy navigation
            this.data.watch.allLines = [];
            play.scenes.forEach((scene, si) => {
                scene.lines.forEach((line, li) => {
                    this.data.watch.allLines.push({
                        sceneIdx: si,
                        lineIdxInScene: li,
                        sceneId: scene.id,
                        sceneTitleEn: scene.title_en,
                        sceneTitleZh: scene.title_zh,
                        sceneNumber: scene.number,
                        characterId: line.character_id,
                        textEn: line.text_en,
                        textZh: line.text_zh,
                        stageDirEn: line.stage_direction_en || '',
                        stageDirZh: line.stage_direction_zh || '',
                        isChorus: line.is_chorus || false
                    });
                });
            });

            const totalLines = this.data.watch.allLines.length;

            let html = `
                <a class="back-link" onclick="App.navigate('/play/${playId}')">← Back / 返回</a>
                <div class="watch-header">
                    <span class="watch-emoji">${play.cover_emoji}</span>
                    <div>
                        <div class="watch-title" id="watchTitle">${play.title_en}</div>
                        <div class="watch-title-zh" id="watchTitleZh">${play.title_zh}</div>
                    </div>
                </div>

                <!-- Mode Toggle -->
                <div class="watch-mode-toggle">
                    <button class="watch-mode-btn active" id="modeWatch" onclick="App.setWatchMode('watch')">🎬 Watch / 观看</button>
                    <button class="watch-mode-btn" id="modePractice" onclick="App.setWatchMode('practice')">🎭 Practice / 练习</button>
                </div>

                <!-- Character selector (only in practice mode) -->
                <div class="watch-char-select hidden" id="watchCharSelect">
                    <label>Choose your role / 选择你的角色：</label>
                    <select id="watchCharDropdown" onchange="App.selectWatchChar(this.value)">
                        <option value="">-- Select / 请选择 --</option>
                        ${play.characters.map(c => `<option value="${c.id}">${c.emoji} ${c.name_en} (${c.name_zh})</option>`).join('')}
                    </select>
                </div>

                <!-- Language Toggle -->
                <div class="lang-toggle" style="margin-bottom:16px">
                    <button class="lang-btn active" id="wBtnEn" onclick="App.switchWatchLang('en')">🇬🇧 English</button>
                    <button class="lang-btn" id="wBtnZh" onclick="App.switchWatchLang('zh')">🇨🇳 中文</button>
                    <button class="lang-btn" id="wBtnBi" onclick="App.switchWatchLang('bilingual')">🌐 Bilingual / 对照</button>
                </div>

                <!-- Current Line Display (big centered) -->
                <div class="watch-stage" id="watchStage">
                    <div class="watch-scene-label" id="watchSceneLabel">Opening / 开场</div>
                    <div class="watch-line-card" id="watchLineCard">
                        <div class="watch-char-avatar" id="watchCharAvatar">📖</div>
                        <div class="watch-char-name" id="watchCharName">Narrator</div>
                        <div class="watch-line-text" id="watchLineText">Click ▶ to start! / 点击 ▶ 开始！</div>
                        <div class="watch-line-text-alt hidden" id="watchLineTextAlt"></div>
                        <div class="watch-stage-dir hidden" id="watchStageDir"></div>
                        <div class="watch-prompt hidden" id="watchPrompt">🎤 Your turn! Read this line! / 轮到你了！朗读这句！</div>
                    </div>
                </div>

                <!-- Player Controls -->
                <div class="watch-controls">
                    <button class="watch-ctrl-btn" onclick="App.watchPrev()" title="Previous / 上一句">⏮</button>
                    <button class="watch-ctrl-btn watch-play-btn" id="watchPlayBtn" onclick="App.watchTogglePlay()" title="Play / 播放">▶</button>
                    <button class="watch-ctrl-btn" onclick="App.watchNext()" title="Next / 下一句">⏭</button>
                    <button class="watch-ctrl-btn" id="watchMuteBtn" onclick="App.watchToggleMute()" title="Mute / 静音">🔊</button>
                </div>

                <!-- Practice action buttons (visible in practice mode when it's user's turn) -->
                <div class="watch-practice-actions hidden" id="watchPracticeActions">
                    <button class="btn btn-warning btn-lg" id="watchReadBtn" onclick="App.watchAIReadLine()">
                        🔊 Listen First / 先听标准读法
                    </button>
                    <button class="btn btn-success btn-lg hidden" id="watchFollowBtn" onclick="App.watchFollowRead()">
                        🎤 跟读 / Read After Me
                    </button>
                    <button class="btn btn-primary btn-lg hidden" id="watchNextLineBtn" onclick="App.watchNextAfterPractice()">
                        ▶ Continue / 继续下一句
                    </button>
                </div>

                <!-- Progress -->
                <div class="watch-progress">
                    <div class="watch-progress-bar" id="watchProgressBar">
                        <div class="watch-progress-fill" id="watchProgressFill" style="width:0%"></div>
                    </div>
                    <div class="watch-progress-text" id="watchProgressText">0 / ${totalLines}</div>
                </div>

                <!-- Score result for practice mode -->
                <div class="watch-score-result hidden" id="watchScoreResult"></div>

                <!-- Script Navigator -->
                <div class="watch-script-nav" id="watchScriptNav">
                    ${this.renderWatchScriptNav(play)}
                </div>
            `;

            container.innerHTML = html;
            // Show initial state
            this.showWatchCurrentLine();
        } catch (e) {
            console.error('Watch page error:', e);
            container.innerHTML = `<div class="empty-state"><div class="emoji">😢</div><p>Failed to load: ${e.message}</p></div>`;
        }
    },

    renderWatchScriptNav(play) {
        const w = this.data.watch;
        const lang = w ? w.lang : 'en';
        let html = '';
        let globalIdx = 0;
        for (let si = 0; si < play.scenes.length; si++) {
            const scene = play.scenes[si];
            const title = lang === 'zh' ? scene.title_zh : (lang === 'bilingual' ? `${scene.title_en} / ${scene.title_zh}` : scene.title_en);
            html += `<div class="watch-nav-scene" data-scene-idx="${si}">
                <div class="watch-nav-scene-title" onclick="App.watchJumpScene(${si})">${scene.number > 0 ? `Scene ${scene.number}: ` : ''}${title}</div>`;
            for (const line of scene.lines) {
                const char = play.characters.find(c => c.id === line.character_id);
                const charName = char ? (lang === 'zh' ? char.name_zh : char.name_en) : '';
                const charEmoji = char ? char.emoji : '';
                const text = lang === 'zh' ? line.text_zh : (lang === 'bilingual' ? `${line.text_en}<br><span style="color:var(--text-secondary);font-size:0.85rem">${line.text_zh}</span>` : line.text_en);
                html += `<div class="watch-nav-line" id="watchNavLine_${globalIdx}" data-line-idx="${globalIdx}" onclick="App.watchJumpLine(${globalIdx})">
                    <span class="watch-nav-char" style="color:${char ? char.color : 'inherit'}">${charEmoji} ${charName}</span>
                    <span class="watch-nav-text">${text}</span>
                </div>`;
                globalIdx++;
            }
            html += '</div>';
        }
        return html;
    },

    setWatchMode(mode) {
        const w = this.data.watch;
        w.mode = mode;
        w.isPlaying = false;
        w.practiceStep = 'idle';
        if (window.speechSynthesis) window.speechSynthesis.cancel();

        document.getElementById('modeWatch').classList.toggle('active', mode === 'watch');
        document.getElementById('modePractice').classList.toggle('active', mode === 'practice');
        document.getElementById('watchCharSelect').classList.toggle('hidden', mode === 'watch');
        document.getElementById('watchPlayBtn').textContent = '▶';

        // Hide practice actions when switching to watch mode
        if (mode === 'watch') {
            document.getElementById('watchPracticeActions').classList.add('hidden');
        }
        // If in practice mode, check current line
        if (mode === 'practice') {
            this.checkPracticeLine();
        }
    },

    selectWatchChar(charId) {
        this.data.watch.characterId = charId || null;
        this.data.watch.practiceStep = 'idle';
        this.highlightWatchCurrentLine();
        this.checkPracticeLine();
    },

    checkPracticeLine() {
        const w = this.data.watch;
        if (w.mode !== 'practice' || !w.characterId) {
            document.getElementById('watchPracticeActions').classList.add('hidden');
            return;
        }
        const lineData = w.allLines[w.currentLineIdx];
        if (!lineData) return;

        const isMyLine = lineData.characterId === w.characterId;
        if (isMyLine) {
            // Show practice actions
            document.getElementById('watchPracticeActions').classList.remove('hidden');
            document.getElementById('watchReadBtn').classList.remove('hidden');
            document.getElementById('watchFollowBtn').classList.add('hidden');
            document.getElementById('watchNextLineBtn').classList.add('hidden');
            document.getElementById('watchPrompt').classList.remove('hidden');
            w.practiceStep = 'waiting-user';
        } else {
            document.getElementById('watchPracticeActions').classList.add('hidden');
            document.getElementById('watchPrompt').classList.add('hidden');
            w.practiceStep = 'idle';
        }
        // Update card highlight
        const card = document.getElementById('watchLineCard');
        card.classList.toggle('watch-line-mine', isMyLine);
    },

    switchWatchLang(lang) {
        const w = this.data.watch;
        w.lang = lang;
        document.getElementById('wBtnEn').classList.toggle('active', lang === 'en');
        document.getElementById('wBtnZh').classList.toggle('active', lang === 'zh');
        document.getElementById('wBtnBi').classList.toggle('active', lang === 'bilingual');

        // Re-render script nav
        document.getElementById('watchScriptNav').innerHTML = this.renderWatchScriptNav(w.play);
        // Update current line display
        this.showWatchCurrentLine();
    },

    watchTogglePlay() {
        const w = this.data.watch;
        if (w.isPlaying) {
            // Pause
            w.isPlaying = false;
            if (window.speechSynthesis) window.speechSynthesis.cancel();
            document.getElementById('watchPlayBtn').textContent = '▶';
        } else {
            // Play
            w.isPlaying = true;
            document.getElementById('watchPlayBtn').textContent = '⏸';
            this.watchPlayCurrentLine();
        }
    },

    // Helper: play a line using reference audio (priority) or SpeechSynthesis (fallback)
    // Returns a Promise that resolves when playback is done
    watchPlayAudio(lineData, lang) {
        return new Promise((resolve) => {
            const w = this.data.watch;

            // 1. Check if we have a reference audio for this line
            const lineIndex = w.allLines.indexOf(lineData);
            const refKey = `${lineData.characterId}|${lineIndex}|${lang === 'bilingual' ? 'en' : lang}`;
            const refFile = w.refAudio[refKey];

            if (refFile && !w.isMuted) {
                // Play reference audio (human recording)
                const audio = new Audio(`/api/recording/${refFile}`);
                audio.onended = () => resolve();
                audio.onerror = () => {
                    // Fallback to TTS if audio fails
                    this.watchPlayTTS(lineData, lang).then(resolve);
                };
                audio.play().catch(() => {
                    this.watchPlayTTS(lineData, lang).then(resolve);
                });
            } else if (!w.isMuted && window.speechSynthesis) {
                // Fallback to SpeechSynthesis
                this.watchPlayTTS(lineData, lang).then(resolve);
            } else {
                // Muted mode: wait based on text length
                const textLen = (lang === 'zh' ? lineData.textZh : lineData.textEn).length;
                const delay = Math.max(1500, textLen * 120);
                setTimeout(resolve, delay);
            }
        });
    },

    // Helper: play TTS for a line
    watchPlayTTS(lineData, lang) {
        return new Promise((resolve) => {
            if (!window.speechSynthesis) { resolve(); return; }
            const text = lang === 'zh' ? lineData.textZh : (lang === 'bilingual' ? `${lineData.textEn}. ${lineData.textZh}` : lineData.textEn);
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
            utterance.rate = 0.85;
            utterance.onend = resolve;
            utterance.onerror = resolve;
            window.speechSynthesis.speak(utterance);
        });
    },

    watchPlayCurrentLine() {
        const w = this.data.watch;
        if (!w.isPlaying) return;

        const lineData = w.allLines[w.currentLineIdx];
        if (!lineData) {
            w.isPlaying = false;
            document.getElementById('watchPlayBtn').textContent = '▶';
            return;
        }

        // In practice mode, check if this is the user's line
        if (w.mode === 'practice' && w.characterId && lineData.characterId === w.characterId) {
            // This is the user's line — stop auto-play and show practice actions
            w.isPlaying = false;
            document.getElementById('watchPlayBtn').textContent = '▶';
            w.practiceStep = 'waiting-user';
            this.showWatchCurrentLine();
            this.checkPracticeLine();
            return;
        }

        this.showWatchCurrentLine();
        document.getElementById('watchPrompt').classList.add('hidden');

        // Play audio (reference audio or TTS), then advance
        this.watchPlayAudio(lineData, w.lang).then(() => {
            if (w.isPlaying) this.watchAdvance();
        });
    },

    watchAdvance() {
        const w = this.data.watch;
        if (w.currentLineIdx < w.allLines.length - 1) {
            w.currentLineIdx++;
            this.watchPlayCurrentLine();
        } else {
            w.isPlaying = false;
            document.getElementById('watchPlayBtn').textContent = '▶';
            this.showToast('🎬 The End! / 剧终！', 'success');
        }
    },

    watchPrev() {
        const w = this.data.watch;
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        w.isPlaying = false;
        w.practiceStep = 'idle';
        document.getElementById('watchPlayBtn').textContent = '▶';
        document.getElementById('watchPracticeActions').classList.add('hidden');
        document.getElementById('watchScoreResult').classList.add('hidden');
        if (w.currentLineIdx > 0) {
            w.currentLineIdx--;
            this.showWatchCurrentLine();
            if (w.mode === 'practice') this.checkPracticeLine();
        }
    },

    watchNext() {
        const w = this.data.watch;
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        w.isPlaying = false;
        w.practiceStep = 'idle';
        document.getElementById('watchPlayBtn').textContent = '▶';
        document.getElementById('watchPracticeActions').classList.add('hidden');
        document.getElementById('watchScoreResult').classList.add('hidden');
        if (w.currentLineIdx < w.allLines.length - 1) {
            w.currentLineIdx++;
            this.showWatchCurrentLine();
            if (w.mode === 'practice') this.checkPracticeLine();
        }
    },

    watchJumpLine(idx) {
        const w = this.data.watch;
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        w.isPlaying = false;
        w.practiceStep = 'idle';
        document.getElementById('watchPlayBtn').textContent = '▶';
        document.getElementById('watchPracticeActions').classList.add('hidden');
        document.getElementById('watchScoreResult').classList.add('hidden');
        w.currentLineIdx = idx;
        this.showWatchCurrentLine();
        if (w.mode === 'practice') this.checkPracticeLine();
    },

    watchJumpScene(sceneIdx) {
        const w = this.data.watch;
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        w.isPlaying = false;
        w.practiceStep = 'idle';
        document.getElementById('watchPlayBtn').textContent = '▶';
        document.getElementById('watchPracticeActions').classList.add('hidden');
        document.getElementById('watchScoreResult').classList.add('hidden');
        const firstLine = w.allLines.find(l => l.sceneIdx === sceneIdx);
        if (firstLine) {
            w.currentLineIdx = w.allLines.indexOf(firstLine);
            this.showWatchCurrentLine();
            if (w.mode === 'practice') this.checkPracticeLine();
        }
    },

    watchToggleMute() {
        const w = this.data.watch;
        w.isMuted = !w.isMuted;
        document.getElementById('watchMuteBtn').textContent = w.isMuted ? '🔇' : '🔊';
        if (w.isMuted && window.speechSynthesis) window.speechSynthesis.cancel();
    },

    // ===== Practice Mode: AI reads first, then user follows =====

    watchAIReadLine() {
        // Play standard pronunciation: reference audio (human) first, fallback to TTS
        const w = this.data.watch;
        const lineData = w.allLines[w.currentLineIdx];
        if (!lineData) return;

        const readBtn = document.getElementById('watchReadBtn');
        const followBtn = document.getElementById('watchFollowBtn');
        const scoreEl = document.getElementById('watchScoreResult');

        readBtn.disabled = true;
        readBtn.textContent = '🔊 Reading... / 朗读中...';
        scoreEl.classList.add('hidden');

        // Check for reference audio
        const lineIndex = w.currentLineIdx;
        const lang = w.lang === 'bilingual' ? 'en' : w.lang;
        const refKey = `${lineData.characterId}|${lineIndex}|${lang}`;
        const refFile = w.refAudio[refKey];

        const finishReading = () => {
            readBtn.disabled = false;
            readBtn.textContent = '🔊 Listen Again / 再听一遍';
            followBtn.classList.remove('hidden');
            w.practiceStep = 'waiting-user';
        };

        if (refFile) {
            // Play human reference audio
            const audio = new Audio(`/api/recording/${refFile}`);
            audio.onended = finishReading;
            audio.onerror = () => {
                // Fallback to TTS
                this.watchPlayTTS(lineData, w.lang).then(finishReading);
            };
            audio.play().catch(() => {
                this.watchPlayTTS(lineData, w.lang).then(finishReading);
            });
        } else {
            // No reference audio, use TTS
            this.watchPlayTTS(lineData, w.lang).then(finishReading);
        }

        w.practiceStep = 'ai-reading';
    },

    async watchFollowRead() {
        // User reads the line, using SpeechRecognition
        const w = this.data.watch;
        const lineData = w.allLines[w.currentLineIdx];
        if (!lineData) return;

        const lang = w.lang === 'bilingual' ? 'en' : w.lang;
        const expectedText = lang === 'en' ? lineData.textEn : lineData.textZh;

        const followBtn = document.getElementById('watchFollowBtn');
        const nextBtn = document.getElementById('watchNextLineBtn');
        const scoreEl = document.getElementById('watchScoreResult');

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            // Fallback: text input
            followBtn.textContent = '🎤 Click to Read / 点击跟读';
            const userInput = prompt(
                lang === 'en'
                    ? `Read this line and type what you said:\n"${expectedText}"`
                    : `朗读这句话，然后输入你说的内容：\n"${expectedText}"`
            );
            if (userInput && userInput.trim()) {
                try {
                    const res = await fetch('/api/score', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            play_id: w.play.id,
                            character_id: w.characterId || lineData.characterId,
                            lang: lang,
                            scene_id: lineData.sceneId,
                            recognized_text: userInput.trim(),
                            expected_text: expectedText
                        })
                    });
                    const data = await res.json();
                    this.showWatchScore(data);
                } catch(e) {
                    scoreEl.classList.remove('hidden');
                    scoreEl.innerHTML = '❌ Scoring error / 评分出错';
                }
            }
            nextBtn.classList.remove('hidden');
            return;
        }

        // Use Web Speech API for voice recognition
        w.practiceStep = 'user-reading';
        followBtn.textContent = '🔴 Listening... / 正在听...';
        followBtn.disabled = true;

        const recognition = new SpeechRecognition();
        recognition.lang = lang === 'en' ? 'en-US' : 'zh-CN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.continuous = false;

        scoreEl.classList.remove('hidden');
        scoreEl.innerHTML = '🔴 <span style="color:var(--danger);font-size:1rem">' + (lang === 'en' ? 'Listening... Please read now!' : '正在听...请朗读！') + '</span>';

        recognition.onresult = async (event) => {
            const recognized = event.results[0][0].transcript;
            try {
                const res = await fetch('/api/score', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        play_id: w.play.id,
                        character_id: w.characterId || lineData.characterId,
                        lang: lang,
                        scene_id: lineData.sceneId,
                        recognized_text: recognized,
                        expected_text: expectedText
                    })
                });
                const data = await res.json();
                this.showWatchScore(data);
            } catch(e) {
                scoreEl.classList.remove('hidden');
                scoreEl.innerHTML = '❌ Scoring error / 评分出错';
            }
            followBtn.textContent = '🎤 跟读 / Read Again';
            followBtn.disabled = false;
            nextBtn.classList.remove('hidden');
            w.practiceStep = 'scored';
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            scoreEl.classList.remove('hidden');
            if (event.error === 'not-allowed') {
                scoreEl.innerHTML = '❌ Microphone blocked. Please allow microphone access in browser settings. / 麦克风被禁止，请在浏览器设置中允许';
            } else if (event.error === 'no-speech') {
                scoreEl.innerHTML = '⚠️ No speech detected. Try again. / 没有检测到语音，请再试一次';
            } else {
                scoreEl.innerHTML = `❌ Recognition error: ${event.error} / 识别出错`;
            }
            followBtn.textContent = '🎤 跟读 / Read Again';
            followBtn.disabled = false;
            nextBtn.classList.remove('hidden');
        };

        recognition.start();
    },

    watchNextAfterPractice() {
        // Move to next line after practice is done
        const w = this.data.watch;
        document.getElementById('watchScoreResult').classList.add('hidden');
        this.watchNext();
    },

    showWatchCurrentLine() {
        const w = this.data.watch;
        const lineData = w.allLines[w.currentLineIdx];
        if (!lineData) return;

        const char = w.play.characters.find(c => c.id === lineData.characterId);
        const lang = w.lang;

        // Scene label
        const sceneLabel = lang === 'zh' ? lineData.sceneTitleZh : (lang === 'bilingual' ? `${lineData.sceneTitleEn} / ${lineData.sceneTitleZh}` : lineData.sceneTitleEn);
        document.getElementById('watchSceneLabel').textContent = lineData.sceneNumber > 0 ? `Scene ${lineData.sceneNumber}: ${sceneLabel}` : sceneLabel;

        // Character
        document.getElementById('watchCharAvatar').textContent = char ? char.emoji : '🎭';
        document.getElementById('watchCharName').textContent = char ? (lang === 'zh' ? char.name_zh : `${char.name_en} (${char.name_zh})`) : '';
        document.getElementById('watchCharName').style.color = char ? char.color : 'inherit';

        // Line text
        const mainText = lang === 'zh' ? lineData.textZh : lineData.textEn;
        document.getElementById('watchLineText').textContent = mainText;

        // Alt text (bilingual mode)
        const altEl = document.getElementById('watchLineTextAlt');
        if (lang === 'bilingual') {
            altEl.textContent = lang === 'zh' ? lineData.textEn : lineData.textZh;
            altEl.classList.remove('hidden');
        } else {
            altEl.classList.add('hidden');
        }

        // Stage direction
        const sdEl = document.getElementById('watchStageDir');
        const sd = lang === 'zh' ? lineData.stageDirZh : (lang === 'bilingual' ? `${lineData.stageDirEn} / ${lineData.stageDirZh}` : lineData.stageDirEn);
        if (sd) {
            sdEl.textContent = `(${sd})`;
            sdEl.classList.remove('hidden');
        } else {
            sdEl.classList.add('hidden');
        }

        // Card highlight in practice mode
        const card = document.getElementById('watchLineCard');
        if (w.mode === 'practice' && w.characterId && lineData.characterId === w.characterId) {
            card.classList.add('watch-line-mine');
        } else {
            card.classList.remove('watch-line-mine');
        }

        // Update progress
        const total = w.allLines.length;
        const pct = Math.round(((w.currentLineIdx + 1) / total) * 100);
        document.getElementById('watchProgressFill').style.width = pct + '%';
        document.getElementById('watchProgressText').textContent = `${w.currentLineIdx + 1} / ${total}`;

        // Highlight in script nav
        this.highlightWatchCurrentLine();
    },

    highlightWatchCurrentLine() {
        const w = this.data.watch;
        // Remove all highlights
        document.querySelectorAll('.watch-nav-line.active').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.watch-nav-line.is-my-line').forEach(el => el.classList.remove('is-my-line'));

        // Add highlight to current line
        const navLine = document.getElementById(`watchNavLine_${w.currentLineIdx}`);
        if (navLine) {
            navLine.classList.add('active');
            navLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // In practice mode, mark the user's lines
        if (w.mode === 'practice' && w.characterId) {
            w.allLines.forEach((line, idx) => {
                if (line.characterId === w.characterId) {
                    const el = document.getElementById(`watchNavLine_${idx}`);
                    if (el) el.classList.add('is-my-line');
                }
            });
        }
    },

    showWatchScore(data) {
        const scoreEl = document.getElementById('watchScoreResult');
        scoreEl.classList.remove('hidden');
        const icon = data.passed ? '✅' : '❌';
        const color = data.passed ? 'var(--success)' : 'var(--danger)';
        scoreEl.innerHTML = `${icon} <span style="color:${color};font-weight:700;font-size:1.2rem">${data.score}分</span> ${data.passed ? '/ Pass! ✨' : '(需80分以上)'}`;
    },

    // ========== Practice Page ==========
    async renderPractice(container, playId, characterId) {
        container.innerHTML = '<div class="empty-state"><div class="emoji">📖</div><p>Loading...</p></div>';
        try {
            const [linesRes, bilRes, recsRes] = await Promise.all([
                fetch(`/api/lines/${playId}/${characterId}?lang=en`),
                fetch(`/api/lines-bilingual/${playId}/${characterId}`),
                fetch(`/api/recordings/${playId}/${characterId}`)
            ]);

            if (!linesRes.ok) {
                container.innerHTML = `<div class="empty-state"><div class="emoji">😢</div><p>Failed to load lines (HTTP ${linesRes.status})</p></div>`;
                return;
            }
            if (!bilRes.ok) {
                container.innerHTML = `<div class="empty-state"><div class="emoji">😢</div><p>Failed to load bilingual data (HTTP ${bilRes.status})</p></div>`;
                return;
            }

            const linesData = await linesRes.json();
            const bilingualData = await bilRes.json();
            const recordings = await recsRes.json();

            const char = linesData.character;
            this.data.practice = { playId, characterId, char, linesData, bilingualData, recordings, lang: 'en' };

            const play = await (await fetch(`/api/play/${playId}`)).json();
            const playTitle = play.title_en;

            // Separate recordings by language
            const enRecs = recordings.filter(r => r.lang === 'en');
            const zhRecs = recordings.filter(r => r.lang === 'zh');

            let html = `
                <a class="back-link" onclick="App.navigate('/play/${playId}')">← ${playTitle}</a>

                <div class="practice-header">
                    <div class="practice-title">${char.emoji} ${char.name_en} (${char.name_zh})</div>
                    <div class="practice-actions">
                        <a class="btn btn-primary" href="/api/lines-text/${playId}/${characterId}?mode=bilingual" download>📥 中英对照下载 / Bilingual Download</a>
                        <a class="btn btn-outline" id="downloadSingleBtn" href="/api/lines-text/${playId}/${characterId}?lang=en" download>📥 EN Only</a>
                        <a class="btn btn-outline" href="/api/lines-text/${playId}/${characterId}?lang=zh" download>📥 中文版</a>
                    </div>
                </div>

                <div class="lang-toggle" style="margin-bottom:20px">
                    <button class="lang-btn active" id="pBtnEn" onclick="App.switchPracticeLang('en')">🇬🇧 English</button>
                    <button class="lang-btn" id="pBtnZh" onclick="App.switchPracticeLang('zh')">🇨🇳 中文</button>
                    <button class="lang-btn" id="pBtnBi" onclick="App.switchPracticeLang('bilingual')">🌐 Bilingual / 对照</button>
                </div>

                <div class="script-container" id="practiceScript">
                    ${this.renderPracticeLines(linesData, 'en')}
                </div>

                <!-- Recording Section -->
                <div class="recording-section" id="recordingSection">
                    <h3 class="section-title" style="margin-top:0">🎤 Recordings / 录音</h3>

                    <div class="recording-lang-tabs">
                        <button class="rec-tab active" id="recTabEn" onclick="App.switchRecTab('en')">🇬🇧 English Recording</button>
                        <button class="rec-tab" id="recTabZh" onclick="App.switchRecTab('zh')">🇨🇳 中文录音</button>
                    </div>

                    <div id="recContentEn">
                        <div class="recording-controls">
                            <button class="record-btn" id="recordBtnEn" onclick="App.startRecordingFor('en')"></button>
                            <span class="recording-hint" id="recordingHintEn">Click to record English / 点击录制英文</span>
                        </div>
                        <div class="recording-list" id="recordingListEn">
                            ${this.renderRecordings(enRecs)}
                        </div>
                    </div>

                    <div id="recContentZh" style="display:none">
                        <div class="recording-controls">
                            <button class="record-btn" id="recordBtnZh" onclick="App.startRecordingFor('zh')"></button>
                            <span class="recording-hint" id="recordingHintZh">Click to record Chinese / 点击录制中文</span>
                        </div>
                        <div class="recording-list" id="recordingListZh">
                            ${this.renderRecordings(zhRecs)}
                        </div>
                    </div>
                </div>

                <!-- Practice & Score Section -->
                <div class="practice-section">
                    <h3 class="section-title">🎯 Practice & Score / 练习与评分</h3>
                    <p class="practice-hint">Read your lines aloud. The computer will score your pronunciation. You need <strong>80 points</strong> or higher to join the performance!</p>
                    <p class="practice-hint">大声朗读你的台词，电脑会给你打分。需要<strong>80分</strong>以上才能参加演出！</p>

                    <div class="practice-lines-list" id="practiceLinesList">
                        ${this.renderPracticeScoreLines(bilingualData)}
                    </div>

                    <div id="scoreHistory" style="margin-top:20px"></div>
                </div>
            `;

            container.innerHTML = html;
            this.loadScores(playId, characterId);
        } catch (e) {
            console.error('Practice page error:', e);
            container.innerHTML = `<div class="empty-state"><div class="emoji">😢</div><p>Failed to load: ${e.message || 'Unknown error'}</p><p style="font-size:0.8rem;color:var(--text-secondary)">Try refreshing the page, or click Back to return.</p></div>`;
        }
    },

    renderPracticeLines(data, lang) {
        const charId = data.character?.id;
        let html = '';
        for (const scene of data.scenes) {
            const stageDir = scene.stage_direction;
            html += `<div class="scene-block">
                <div class="scene-header"><span class="arrow">▼</span>${scene.scene_title}</div>`;
            if (stageDir) {
                html += `<div class="scene-stage-dir">(${stageDir})</div>`;
            }
            html += `<div class="scene-lines">`;
            for (const line of scene.lines) {
                if (line.is_mine) {
                    html += `<div class="line-mine">
                        <div class="line-row">
                            <div class="line-char" style="color:var(--primary)">⭐ ${line.character_name}</div>
                            <div class="line-text">
                                ${line.stage_direction ? `<span class="line-stage-dir">(${line.stage_direction}) </span>` : ''}
                                ${line.text}
                                ${line.text_other ? `<div class="line-translation">↳ ${line.text_other}</div>` : ''}
                            </div>
                        </div>
                    </div>`;
                } else {
                    html += `<div class="line-row">
                        <div class="line-char">${line.character_emoji} ${line.character_name}</div>
                        <div class="line-text">${line.text}
                            ${line.text_other ? `<div class="line-translation">↳ ${line.text_other}</div>` : ''}
                        </div>
                    </div>`;
                }
            }
            html += '</div></div>';
        }
        return html;
    },

    renderPracticeScoreLines(bilingualData) {
        let html = '';
        let lineIndex = 0;
        const { playId, characterId } = this.data.practice;
        for (const scene of bilingualData.scenes) {
            html += `<div class="score-scene">
                <h4>Scene ${scene.scene_number}: ${scene.scene_title_en} / ${scene.scene_title_zh}</h4>`;
            for (const line of scene.lines) {
                html += `<div class="score-line" id="scoreLine_${lineIndex}">
                    <div class="score-line-text">
                        <div class="score-line-en">🇬🇧 ${line.text_en}</div>
                        <div class="score-line-zh">🇨🇳 ${line.text_zh}</div>
                    </div>
                    <div class="score-line-actions">
                        <button class="btn btn-primary btn-sm" onclick="App.practiceLine(${lineIndex}, 'en')">🎤 Practice EN</button>
                        <button class="btn btn-success btn-sm" onclick="App.practiceLine(${lineIndex}, 'zh')">🎤 练习中文</button>
                        <label class="btn btn-outline btn-sm ref-upload-btn" title="Upload standard pronunciation / 上传标准读音">
                            📤 Upload Ref
                            <input type="file" accept="audio/*" style="display:none" onchange="App.uploadRefAudio(this, ${playId}, '${characterId}', ${lineIndex}, 'en')">
                        </label>
                        <label class="btn btn-outline btn-sm ref-upload-btn" title="上传中文标准读音">
                            📤 上传读音
                            <input type="file" accept="audio/*" style="display:none" onchange="App.uploadRefAudio(this, ${playId}, '${characterId}', ${lineIndex}, 'zh')">
                        </label>
                        <span class="score-result" id="scoreResult_${lineIndex}"></span>
                    </div>
                </div>`;
                lineIndex++;
            }
        }
        html += '</div>';
        this.data.practice.scoreLineData = bilingualData;
        return html;
    },

    async uploadRefAudio(inputEl, playId, characterId, lineIndex, lang) {
        const file = inputEl.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('audio', file);
        formData.append('play_id', playId);
        formData.append('character_id', characterId);
        formData.append('scene_id', 'practice');
        formData.append('line_index', lineIndex);
        formData.append('lang', lang);
        formData.append('player_name', 'Reference');
        formData.append('is_reference', '1');

        try {
            const res = await fetch('/api/record', { method: 'POST', body: formData });
            if (res.ok) {
                this.showToast(`✅ ${lang === 'en' ? 'English' : 'Chinese'} reference audio uploaded! / ${lang === 'en' ? '英文' : '中文'}标准读音已上传！`, 'success');
                inputEl.value = '';
            } else {
                this.showToast('❌ Upload failed / 上传失败', 'error');
            }
        } catch(e) {
            this.showToast('❌ Upload error / 上传出错', 'error');
        }
    },

    async practiceLine(lineIndex, lang) {
        const bilingualData = this.data.practice.bilingualData;
        const { playId, characterId } = this.data.practice;

        // Find the line
        let line = null;
        let idx = 0;
        for (const scene of bilingualData.scenes) {
            for (const l of scene.lines) {
                if (idx === lineIndex) { line = l; break; }
                idx++;
            }
            if (line) break;
        }
        if (!line) return;

        const expectedText = lang === 'en' ? line.text_en : line.text_zh;

        // Check for speech recognition support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            // Fallback: simple text input scoring
            const userInput = prompt(
                lang === 'en'
                    ? `Read this line and type what you said:\n"${expectedText}"`
                    : `朗读这句话，然后输入你说的内容：\n"${expectedText}"`
            );
            if (userInput && userInput.trim()) {
                const res = await fetch('/api/score', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        play_id: playId,
                        character_id: characterId,
                        lang: lang,
                        scene_id: 'practice',
                        recognized_text: userInput.trim(),
                        expected_text: expectedText
                    })
                });
                const data = await res.json();
                this.showLineScore(lineIndex, data);
            }
            return;
        }

        // Use Web Speech API
        const recognition = new SpeechRecognition();
        recognition.lang = lang === 'en' ? 'en-US' : 'zh-CN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        const resultEl = document.getElementById(`scoreResult_${lineIndex}`);
        resultEl.innerHTML = '🔴 <span style="color:var(--danger)">' + (lang === 'en' ? 'Listening...' : '正在听...') + '</span>';

        recognition.onresult = async (event) => {
            const recognized = event.results[0][0].transcript;
            const res = await fetch('/api/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    play_id: playId,
                    character_id: characterId,
                    lang: lang,
                    scene_id: 'practice',
                    recognized_text: recognized,
                    expected_text: expectedText
                })
            });
            const data = await res.json();
            this.showLineScore(lineIndex, data);
        };

        recognition.onerror = (event) => {
            resultEl.innerHTML = `❌ ${lang === 'en' ? 'Speech recognition error' : '语音识别出错'}`;
        };

        recognition.start();
    },

    showLineScore(lineIndex, data) {
        const resultEl = document.getElementById(`scoreResult_${lineIndex}`);
        const passed = data.passed;
        const icon = passed ? '✅' : '❌';
        const color = passed ? 'var(--success)' : 'var(--danger)';
        resultEl.innerHTML = `${icon} <span style="color:${color};font-weight:700;font-size:1.1rem">${data.score}分</span> ${passed ? '/ Pass! ✨' : '(需80分以上)'}`;
    },

    async loadScores(playId, characterId) {
        try {
            const res = await fetch(`/api/scores/${playId}/${characterId}`);
            const scores = await res.json();
            if (scores.length > 0) {
                const best = scores.reduce((a, b) => a.score > b.score ? a : b);
                const div = document.getElementById('scoreHistory');
                if (div) {
                    div.innerHTML = `
                        <div class="score-history">
                            <h4>📊 Recent Scores / 最近评分</h4>
                            <div class="score-items">
                                ${scores.slice(0, 5).map(s => `
                                    <span class="score-badge ${s.passed ? 'score-pass' : 'score-fail'}">
                                        ${s.lang === 'en' ? '🇬🇧' : '🇨🇳'} ${s.score}分 ${s.passed ? '✅' : '❌'}
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }
            }
        } catch(e) {}
    },

    switchRecTab(lang) {
        document.getElementById('recTabEn').classList.toggle('active', lang === 'en');
        document.getElementById('recTabZh').classList.toggle('active', lang === 'zh');
        document.getElementById('recContentEn').style.display = lang === 'en' ? 'block' : 'none';
        document.getElementById('recContentZh').style.display = lang === 'zh' ? 'block' : 'none';
    },

    async switchPracticeLang(lang) {
        this.data.practice.lang = lang;
        const { playId, characterId, char } = this.data.practice;

        document.getElementById('pBtnEn').classList.toggle('active', lang === 'en');
        document.getElementById('pBtnZh').classList.toggle('active', lang === 'zh');
        document.getElementById('pBtnBi').classList.toggle('active', lang === 'bilingual');

        document.querySelector('.practice-title').textContent =
            `${char.emoji} ${char.name_en} (${char.name_zh})`;

        if (lang === 'bilingual') {
            const bilData = this.data.practice.bilingualData;
            document.getElementById('practiceScript').innerHTML = this.renderBilingualLines(bilData);
        } else {
            const res = await fetch(`/api/lines/${playId}/${characterId}?lang=${lang}`);
            const linesData = await res.json();
            this.data.practice.linesData = linesData;
            document.getElementById('practiceScript').innerHTML = this.renderPracticeLines(linesData, lang);
        }
    },

    renderBilingualLines(bilingualData) {
        let html = '';
        for (const scene of bilingualData.scenes) {
            html += `<div class="scene-block">
                <div class="scene-header"><span class="arrow">▼</span>${scene.scene_title_en} / ${scene.scene_title_zh}</div>
                <div class="scene-lines">`;
            for (const line of scene.lines) {
                html += `<div class="line-mine bilingual-line">
                    <div class="line-row" style="flex-direction:column;gap:4px">
                        <div class="line-text"><strong>🇬🇧 EN:</strong> ${line.text_en}</div>
                        <div class="line-text"><strong>🇨🇳 ZH:</strong> ${line.text_zh}</div>
                    </div>
                </div>`;
            }
            html += '</div></div>';
        }
        return html;
    },

    renderRecordings(recordings) {
        if (!recordings || recordings.length === 0) {
            return '<p style="color:var(--text-secondary);font-size:0.9rem;">No recordings yet / 还没有录音</p>';
        }
        let html = '';
        for (const rec of recordings) {
            const date = new Date(rec.created_at).toLocaleDateString();
            const refBadge = rec.is_reference ? ' [Reference/标准]' : '';
            html += `<div class="recording-item">
                <span>🎤</span>
                <audio controls src="/api/recording/${rec.file_path}" preload="none"></audio>
                <span class="recording-time">${date}${refBadge}</span>
            </div>`;
        }
        return html;
    },

    // ========== Recording ==========
    async startRecordingFor(lang) {
        this.currentRecordingLang = lang;
        const btnId = lang === 'en' ? 'recordBtnEn' : 'recordBtnZh';
        const hintId = lang === 'en' ? 'recordingHintEn' : 'recordingHintZh';

        if (this.isRecording) {
            this.stopRecording();
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioChunks = [];
            this.mediaRecorder = new MediaRecorder(stream);
            this.mediaRecorder.ondataavailable = (e) => {
                this.audioChunks.push(e.data);
            };
            this.mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
                await this.uploadRecording(blob, lang);
            };
            this.mediaRecorder.start();
            this.isRecording = true;

            const btn = document.getElementById(btnId);
            btn.classList.add('recording');
            document.getElementById(hintId).textContent = lang === 'en' ? '🔴 Recording English...' : '🔴 录音中（中文）...';
        } catch (e) {
            this.showToast('❌ Cannot access microphone / 无法访问麦克风', 'error');
        }
    },

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        this.isRecording = false;

        // Reset both buttons
        ['En', 'Zh'].forEach(suffix => {
            const btn = document.getElementById(`recordBtn${suffix}`);
            const hint = document.getElementById(`recordingHint${suffix}`);
            if (btn) btn.classList.remove('recording');
            if (hint) hint.textContent = suffix === 'En' ? 'Click to record English / 点击录制英文' : 'Click to record Chinese / 点击录制中文';
        });
    },

    async uploadRecording(blob, lang) {
        const { playId, characterId } = this.data.practice;
        const formData = new FormData();
        formData.append('audio', blob, 'recording.webm');
        formData.append('play_id', playId);
        formData.append('character_id', characterId);
        formData.append('scene_id', 'all');
        formData.append('player_name', this.data.practice.char?.name_en || 'Unknown');
        formData.append('lang', lang);

        try {
            const res = await fetch('/api/record', { method: 'POST', body: formData });
            if (res.ok) {
                this.showToast(`✅ ${lang === 'en' ? 'English' : 'Chinese'} recording saved! / ${lang === 'en' ? '英文' : '中文'}录音已保存！`, 'success');
                // Refresh recordings
                const recsRes = await fetch(`/api/recordings/${playId}/${characterId}?lang=${lang}`);
                const recordings = await recsRes.json();
                const listId = lang === 'en' ? 'recordingListEn' : 'recordingListZh';
                document.getElementById(listId).innerHTML = this.renderRecordings(recordings);
            }
        } catch (e) {
            this.showToast('❌ Upload error / 上传出错', 'error');
        }
    },

    // ========== Toast ==========
    showToast(message, type = 'success') {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
