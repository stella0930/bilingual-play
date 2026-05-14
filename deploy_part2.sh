#!/bin/bash
# Part 2: 创建 HTML 模板和前端文件

echo "📝 创建 HTML 模板..."

# index.html
cat > ~/bilingual-play/templates/index.html << 'ENDOFFILE'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bilingual Playhouse 🎭</title>
    <link rel="stylesheet" href="/static/css/style.css">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body>
    <nav class="navbar">
        <div class="nav-brand" onclick="location.href='/'">🎭 Bilingual Playhouse</div>
        <div class="nav-subtitle">双语小剧场</div>
    </nav>
    <main class="container" id="app"></main>
    <script src="/static/js/app.js"></script>
</body>
</html>
ENDOFFILE

# play.html (same as index.html)
cp ~/bilingual-play/templates/index.html ~/bilingual-play/templates/play.html

# practice.html (same as index.html)
cp ~/bilingual-play/templates/index.html ~/bilingual-play/templates/practice.html

echo "✅ HTML 模板创建完成"

# 创建 CSS
echo "📝 创建 CSS..."
cat > ~/bilingual-play/static/css/style.css << 'ENDOFCSSEND'
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#F8FAFC;--card-bg:#FFFFFF;--text:#1E293B;--text-secondary:#64748B;--primary:#6366F1;--primary-light:#EEF2FF;--primary-hover:#4F46E5;--success:#10B981;--success-light:#ECFDF5;--warning:#F59E0B;--warning-light:#FFFBEB;--danger:#EF4444;--danger-light:#FEF2F2;--border:#E2E8F0;--shadow:0 1px 3px rgba(0,0,0,0.08),0 1px 2px rgba(0,0,0,0.06);--shadow-md:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -2px rgba(0,0,0,0.1);--shadow-lg:0 10px 15px -3px rgba(0,0,0,0.1),0 4px 6px -4px rgba(0,0,0,0.1);--radius:12px;--radius-lg:16px}
body{font-family:'Nunito','Noto Sans SC',sans-serif;background:var(--bg);color:var(--text);line-height:1.6;min-height:100vh}
.navbar{background:var(--card-bg);border-bottom:1px solid var(--border);padding:12px 24px;display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:100;box-shadow:var(--shadow)}
.nav-brand{font-size:1.3rem;font-weight:800;color:var(--primary);cursor:pointer;display:flex;align-items:center;gap:8px}
.nav-subtitle{font-size:0.9rem;color:var(--text-secondary);font-weight:500}
.container{max-width:900px;margin:0 auto;padding:24px 16px}
.page-title{font-size:1.8rem;font-weight:800;margin-bottom:4px}
.page-subtitle{font-size:1rem;color:var(--text-secondary);margin-bottom:24px}
.play-cards{display:grid;gap:16px}
.play-card{background:var(--card-bg);border-radius:var(--radius-lg);padding:24px;box-shadow:var(--shadow);border:1px solid var(--border);cursor:pointer;transition:all 0.2s;text-decoration:none;color:inherit;display:block}
.play-card:hover{box-shadow:var(--shadow-lg);transform:translateY(-2px);border-color:var(--primary)}
.play-card-header{display:flex;align-items:center;gap:16px;margin-bottom:12px}
.play-card-emoji{font-size:3rem;line-height:1}
.play-card-title{font-size:1.3rem;font-weight:700}
.play-card-title-zh{font-size:1rem;color:var(--text-secondary);font-weight:500}
.play-card-desc{font-size:0.9rem;color:var(--text-secondary);margin-bottom:16px;line-height:1.5}
.play-card-meta{display:flex;gap:12px;flex-wrap:wrap}
.meta-badge{font-size:0.8rem;padding:4px 10px;border-radius:20px;font-weight:600}
.badge-scenes{background:var(--primary-light);color:var(--primary)}
.badge-chars{background:var(--success-light);color:var(--success)}
.play-header{text-align:center;margin-bottom:32px}
.play-header-emoji{font-size:4rem;margin-bottom:8px}
.play-header-title{font-size:2rem;font-weight:800}
.play-header-title-zh{font-size:1.2rem;color:var(--text-secondary);margin-bottom:8px}
.lang-toggle{display:flex;justify-content:center;gap:8px;margin:24px 0}
.lang-btn{padding:8px 24px;border-radius:24px;border:2px solid var(--border);background:var(--card-bg);font-size:1rem;font-weight:700;cursor:pointer;transition:all 0.2s;font-family:inherit}
.lang-btn.active{background:var(--primary);color:white;border-color:var(--primary)}
.lang-btn:hover:not(.active){border-color:var(--primary);color:var(--primary)}
.section-title{font-size:1.3rem;font-weight:700;margin:24px 0 12px;display:flex;align-items:center;gap:8px}
.characters-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
.char-card{background:var(--card-bg);border-radius:var(--radius);padding:16px;border:2px solid var(--border);transition:all 0.2s}
.char-card:hover{border-color:var(--primary)}
.char-card-header{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.char-emoji{font-size:1.8rem}
.char-name{font-size:1.1rem;font-weight:700}
.char-name-alt{font-size:0.85rem;color:var(--text-secondary)}
.char-personality{font-size:0.85rem;color:var(--text-secondary);margin-bottom:12px}
.char-claimed{background:var(--success-light);color:var(--success);padding:4px 10px;border-radius:20px;font-size:0.8rem;font-weight:600;display:inline-block}
.char-claimed-by{font-weight:700}
.claim-form{display:flex;gap:8px;margin-top:8px}
.claim-input{flex:1;padding:6px 12px;border-radius:8px;border:1px solid var(--border);font-size:0.9rem;font-family:inherit;outline:none}
.claim-input:focus{border-color:var(--primary)}
.claim-btn{padding:6px 16px;border-radius:8px;border:none;background:var(--primary);color:white;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;transition:background 0.2s}
.claim-btn:hover{background:var(--primary-hover)}
.unclaim-btn{padding:4px 12px;border-radius:8px;border:1px solid var(--danger);background:var(--danger-light);color:var(--danger);font-size:0.8rem;font-weight:600;cursor:pointer;font-family:inherit;margin-top:8px;transition:all 0.2s}
.unclaim-btn:hover{background:var(--danger);color:white}
.script-container{background:var(--card-bg);border-radius:var(--radius-lg);box-shadow:var(--shadow);overflow:hidden}
.scene-block{border-bottom:1px solid var(--border)}
.scene-block:last-child{border-bottom:none}
.scene-header{padding:16px 20px;background:var(--primary-light);font-weight:700;font-size:1.05rem;display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none}
.scene-header:hover{background:#E0E7FF}
.scene-header .arrow{transition:transform 0.2s;font-size:0.8rem}
.scene-header .arrow.collapsed{transform:rotate(-90deg)}
.scene-stage-dir{padding:8px 20px;font-style:italic;color:var(--text-secondary);font-size:0.9rem;background:#F8FAFC}
.scene-lines{padding:12px 20px}
.scene-lines.hidden{display:none}
.line-row{display:flex;gap:12px;padding:6px 0;align-items:flex-start}
.line-char{min-width:90px;font-weight:700;font-size:0.9rem;display:flex;align-items:center;gap:4px;flex-shrink:0}
.line-text{font-size:0.95rem;line-height:1.5}
.line-stage-dir{font-style:italic;color:var(--text-secondary);font-size:0.85rem}
.line-mine{background:#EEF2FF;margin:4px -20px;padding:8px 20px;border-left:4px solid var(--primary)}
.line-mine .line-text{font-weight:700}
.line-chorus{text-align:center;font-weight:700;font-size:1rem;padding:8px 0}
.line-translation{color:var(--text-secondary);font-size:0.85rem;font-style:italic;margin-top:2px}
.bilingual-line{background:#F0FDF4!important;border-left-color:var(--success)!important}
.practice-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px}
.practice-title{font-size:1.4rem;font-weight:800}
.practice-actions{display:flex;gap:8px;flex-wrap:wrap}
.btn{padding:8px 18px;border-radius:10px;border:none;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;transition:all 0.2s;display:inline-flex;align-items:center;gap:6px;text-decoration:none}
.btn-primary{background:var(--primary);color:white}
.btn-primary:hover{background:var(--primary-hover)}
.btn-outline{background:var(--card-bg);color:var(--primary);border:2px solid var(--primary)}
.btn-outline:hover{background:var(--primary-light)}
.btn-success{background:var(--success);color:white}
.btn-success:hover{background:#059669}
.btn-sm{padding:5px 12px;font-size:0.8rem;border-radius:8px}
.recording-section{margin-top:24px;background:var(--card-bg);border-radius:var(--radius);padding:16px;border:1px solid var(--border)}
.recording-lang-tabs{display:flex;gap:8px;margin-bottom:16px}
.rec-tab{padding:8px 20px;border-radius:10px;border:2px solid var(--border);background:var(--card-bg);font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;transition:all 0.2s}
.rec-tab.active{background:var(--primary);color:white;border-color:var(--primary)}
.rec-tab:hover:not(.active){border-color:var(--primary);color:var(--primary)}
.recording-controls{display:flex;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap}
.record-btn{width:48px;height:48px;border-radius:50%;border:3px solid var(--danger);background:var(--card-bg);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;position:relative}
.record-btn:hover{background:var(--danger-light)}
.record-btn.recording{background:var(--danger);animation:pulse 1s infinite}
.record-btn.recording::after{content:'';width:16px;height:16px;background:white;border-radius:3px}
.record-btn:not(.recording)::after{content:'';width:20px;height:20px;background:var(--danger);border-radius:50%}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.4)}50%{box-shadow:0 0 0 12px rgba(239,68,68,0)}}
.recording-hint{font-size:0.9rem;color:var(--text-secondary)}
.recording-list{display:grid;gap:8px}
.recording-item{display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg);border-radius:8px;font-size:0.85rem}
.recording-item audio{height:32px;flex:1}
.recording-time{color:var(--text-secondary);font-size:0.8rem}
.practice-section{margin-top:32px;background:var(--card-bg);border-radius:var(--radius-lg);padding:20px;border:1px solid var(--border);box-shadow:var(--shadow)}
.practice-hint{font-size:0.9rem;color:var(--text-secondary);margin-bottom:8px;line-height:1.6}
.score-scene{margin-bottom:20px}
.score-scene h4{font-size:1rem;color:var(--text);margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border)}
.score-line{display:flex;align-items:flex-start;gap:12px;padding:10px 12px;border-radius:10px;margin-bottom:8px;background:var(--bg);flex-wrap:wrap}
.score-line-text{flex:1;min-width:200px}
.score-line-en{font-size:0.95rem;font-weight:600;margin-bottom:2px}
.score-line-zh{font-size:0.9rem;color:var(--text-secondary)}
.score-line-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.score-result{font-size:0.9rem;font-weight:600;min-width:80px}
.score-history{background:var(--bg);border-radius:var(--radius);padding:16px;margin-top:16px}
.score-history h4{font-size:1rem;margin-bottom:10px}
.score-items{display:flex;gap:8px;flex-wrap:wrap}
.score-badge{padding:4px 12px;border-radius:20px;font-size:0.85rem;font-weight:700}
.score-pass{background:var(--success-light);color:var(--success)}
.score-fail{background:var(--danger-light);color:var(--danger)}
.back-link{display:inline-flex;align-items:center;gap:6px;color:var(--primary);font-weight:600;font-size:0.95rem;cursor:pointer;margin-bottom:16px;text-decoration:none}
.back-link:hover{text-decoration:underline}
.empty-state{text-align:center;padding:40px;color:var(--text-secondary)}
.empty-state .emoji{font-size:3rem;margin-bottom:12px}
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:10px;font-weight:600;font-size:0.9rem;z-index:300;animation:slideUp 0.3s ease;box-shadow:var(--shadow-lg)}
.toast-success{background:var(--success);color:white}
.toast-error{background:var(--danger);color:white}
@keyframes slideUp{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
@media(max-width:640px){.navbar{padding:10px 16px}.container{padding:16px 12px}.page-title{font-size:1.4rem}.play-card{padding:16px}.characters-grid{grid-template-columns:1fr}.line-row{flex-direction:column;gap:2px}.line-char{min-width:unset}.line-mine{margin:4px -12px;padding:8px 12px}.scene-lines{padding:12px}.score-line{flex-direction:column}.practice-actions{flex-direction:column}}
ENDOFCSSEND

echo "✅ CSS 创建完成"

echo ""
echo "📝 创建 JavaScript..."
echo "⚠️ app.js 较长，需要单独处理"
echo ""
echo "🎭 部署脚本 Part 2 完成！"
