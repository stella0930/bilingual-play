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

    // ========== Practice Page ==========
    async renderPractice(container, playId, characterId) {
        container.innerHTML = '<div class="empty-state"><div class="emoji">📖</div><p>Loading...</p></div>';
        try {
            const [linesRes, bilRes, recsRes] = await Promise.all([
                fetch(`/api/lines/${playId}/${characterId}?lang=en`),
                fetch(`/api/lines-bilingual/${playId}/${characterId}`),
                fetch(`/api/recordings/${playId}/${characterId}`)
            ]);
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
                    <div class="practice-title">${char.emoji} ${char.name_en} (${char.name_zh}) - ${lang === 'en' ? 'Practice' : '练习'}</div>
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
            container.innerHTML = '<div class="empty-state"><div class="emoji">😢</div><p>Failed to load</p></div>';
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
