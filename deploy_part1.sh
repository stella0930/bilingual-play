#!/bin/bash
# ============================================================
# Bilingual Playhouse - 一键部署脚本 for PythonAnywhere
# 账号: Stella0930
# 部署后网址: https://stella0930.pythonanywhere.com
# ============================================================

echo "🎭 开始部署 Bilingual Playhouse..."
echo ""

# 1. 创建目录结构
echo "📁 创建目录..."
mkdir -p ~/bilingual-play/data
mkdir -p ~/bilingual-play/static/css
mkdir -p ~/bilingual-play/static/js
mkdir -p ~/bilingual-play/static/uploads
mkdir -p ~/bilingual-play/templates

# 2. 安装依赖
echo "📦 安装 Flask..."
pip install --user flask 2>&1 | tail -3

# 3. 创建 app.py
echo "📝 创建 app.py..."
cat > ~/bilingual-play/app.py << 'ENDOFFILE'
from flask import Flask, render_template, request, jsonify, send_from_directory, send_file, Response
import json, os, sqlite3, uuid, difflib
from datetime import datetime

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'static', 'uploads')
app.config['DATABASE'] = os.path.join(os.path.dirname(__file__), 'data', 'bilingual.db')
app.config['PLAYS_FILE'] = os.path.join(os.path.dirname(__file__), 'data', 'plays.json')

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

def get_db():
    db = sqlite3.connect(app.config['DATABASE'])
    db.row_factory = sqlite3.Row
    return db

def init_db():
    db = get_db()
    db.executescript('''
        CREATE TABLE IF NOT EXISTS role_claims (
            id TEXT PRIMARY KEY,
            play_id INTEGER,
            character_id TEXT,
            player_name TEXT NOT NULL,
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS recordings (
            id TEXT PRIMARY KEY,
            play_id INTEGER,
            character_id TEXT,
            scene_id TEXT,
            lang TEXT DEFAULT 'en',
            file_path TEXT NOT NULL,
            player_name TEXT,
            is_reference INTEGER DEFAULT 0,
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS scores (
            id TEXT PRIMARY KEY,
            play_id INTEGER,
            character_id TEXT,
            lang TEXT,
            scene_id TEXT,
            score REAL,
            passed INTEGER DEFAULT 0,
            created_at TEXT
        );
    ''')
    db.commit()
    db.close()

def load_plays():
    with open(app.config['PLAYS_FILE'], 'r', encoding='utf-8') as f:
        return json.load(f)

def get_play(play_id):
    plays = load_plays()
    for p in plays:
        if p['id'] == play_id:
            return p
    return None

def get_character_full_lines(play, character_id, lang):
    result = []
    for scene in play['scenes']:
        scene_data = {
            'scene_number': scene['number'],
            'scene_id': scene['id'],
            'scene_title': scene.get(f'title_{lang}', scene.get('title_en', '')),
            'stage_direction': scene.get(f'stage_direction_{lang}', scene.get('stage_direction_en', '')),
            'lines': []
        }
        for line in scene['lines']:
            char = None
            for c in play['characters']:
                if c['id'] == line['character_id']:
                    char = c
                    break
            line_data = {
                'character_id': line['character_id'],
                'character_name': char.get(f'name_{lang}', char.get('name_en', '')) if char else '',
                'character_emoji': char.get('emoji', '') if char else '',
                'is_mine': line['character_id'] == character_id,
                'text': line.get(f'text_{lang}', line.get('text_en', ''))
            }
            other_lang = 'zh' if lang == 'en' else 'en'
            line_data['text_other'] = line.get(f'text_{other_lang}', line.get('text_en', ''))
            sd = line.get(f'stage_direction_{lang}', line.get('stage_direction_en', ''))
            if sd:
                line_data['stage_direction'] = sd
            scene_data['lines'].append(line_data)
        result.append(scene_data)
    return result

def get_character_mylines_only(play, character_id, lang):
    result = []
    for scene in play['scenes']:
        scene_lines = []
        for line in scene['lines']:
            if line['character_id'] == character_id:
                other_lang = 'zh' if lang == 'en' else 'en'
                line_data = {
                    'scene_title_en': scene.get('title_en', ''),
                    'scene_title_zh': scene.get('title_zh', ''),
                    'text_en': line.get('text_en', ''),
                    'text_zh': line.get('text_zh', ''),
                }
                sd_en = line.get('stage_direction_en', '')
                sd_zh = line.get('stage_direction_zh', '')
                if sd_en:
                    line_data['stage_direction_en'] = sd_en
                if sd_zh:
                    line_data['stage_direction_zh'] = sd_zh
                scene_lines.append(line_data)
        if scene_lines:
            result.append({
                'scene_number': scene['number'],
                'scene_title_en': scene.get('title_en', ''),
                'scene_title_zh': scene.get('title_zh', ''),
                'lines': scene_lines
            })
    return result

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/play/<int:play_id>')
def play_page(play_id):
    return render_template('play.html', play_id=play_id)

@app.route('/practice/<int:play_id>/<character_id>')
def practice_page(play_id, character_id):
    return render_template('practice.html', play_id=play_id, character_id=character_id)

@app.route('/api/plays')
def api_plays():
    plays = load_plays()
    return jsonify(plays)

@app.route('/api/play/<int:play_id>')
def api_play(play_id):
    play = get_play(play_id)
    if not play:
        return jsonify({'error': 'Play not found'}), 404
    db = get_db()
    claims = db.execute('SELECT * FROM role_claims WHERE play_id = ?', (play_id,)).fetchall()
    claim_map = {c['character_id']: dict(c) for c in claims}
    db.close()
    for char in play['characters']:
        char['claimed_by'] = claim_map.get(char['id'], {}).get('player_name', None)
        char['claim_id'] = claim_map.get(char['id'], {}).get('id', None)
    return jsonify(play)

@app.route('/api/claim', methods=['POST'])
def api_claim():
    data = request.json
    play_id = data.get('play_id')
    character_id = data.get('character_id')
    player_name = data.get('player_name', '').strip()
    if not player_name:
        return jsonify({'error': 'Player name is required'}), 400
    db = get_db()
    existing = db.execute('SELECT * FROM role_claims WHERE play_id = ? AND character_id = ?',
                          (play_id, character_id)).fetchone()
    if existing:
        db.close()
        return jsonify({'error': 'This role has already been claimed', 'claimed_by': existing['player_name']}), 409
    claim_id = str(uuid.uuid4())[:8]
    db.execute('INSERT INTO role_claims (id, play_id, character_id, player_name, created_at) VALUES (?, ?, ?, ?, ?)',
               (claim_id, play_id, character_id, player_name, datetime.now().isoformat()))
    db.commit()
    db.close()
    return jsonify({'success': True, 'claim_id': claim_id})

@app.route('/api/unclaim', methods=['POST'])
def api_unclaim():
    data = request.json
    claim_id = data.get('claim_id')
    db = get_db()
    db.execute('DELETE FROM role_claims WHERE id = ?', (claim_id,))
    db.commit()
    db.close()
    return jsonify({'success': True})

@app.route('/api/lines/<int:play_id>/<character_id>')
def api_lines(play_id, character_id):
    play = get_play(play_id)
    if not play:
        return jsonify({'error': 'Play not found'}), 404
    lang = request.args.get('lang', 'en')
    lines = get_character_full_lines(play, character_id, lang)
    char = None
    for c in play['characters']:
        if c['id'] == character_id:
            char = c
            break
    return jsonify({'character': char, 'scenes': lines, 'lang': lang})

@app.route('/api/lines-bilingual/<int:play_id>/<character_id>')
def api_lines_bilingual(play_id, character_id):
    play = get_play(play_id)
    if not play:
        return jsonify({'error': 'Play not found'}), 404
    lines = get_character_mylines_only(play, character_id, 'en')
    char = None
    for c in play['characters']:
        if c['id'] == character_id:
            char = c
            break
    return jsonify({'character': char, 'scenes': lines})

@app.route('/api/lines-text/<int:play_id>/<character_id>')
def api_lines_text(play_id, character_id):
    play = get_play(play_id)
    if not play:
        return jsonify({'error': 'Play not found'}), 404
    lang = request.args.get('lang', 'en')
    mode = request.args.get('mode', 'single')
    char = None
    for c in play['characters']:
        if c['id'] == character_id:
            char = c
            break
    char_name = char.get(f'name_{lang}', char.get('name_en', '')) if char else ''
    play_title = play.get(f'title_{lang}', play.get('title_en', ''))
    if mode == 'bilingual':
        lines_data = get_character_mylines_only(play, character_id, 'en')
        text = f"{'='*60}\n  {play['title_en']} / {play['title_zh']}\n  {char['name_en']} ({char['name_zh']})'s Lines\n  Bilingual Edition\n{'='*60}\n\n"
        for scene in lines_data:
            text += f"--- {scene['scene_title_en']} / {scene['scene_title_zh']} ---\n\n"
            for line in scene['lines']:
                if line.get('stage_direction_en') or line.get('stage_direction_zh'):
                    sd_en = line.get('stage_direction_en', '')
                    sd_zh = line.get('stage_direction_zh', '')
                    if sd_en:
                        text += f"  ({sd_en}"
                        if sd_zh: text += f" / {sd_zh}"
                        text += ")\n"
                text += f"  EN: {line['text_en']}\n  ZH: {line['text_zh']}\n\n"
    else:
        lines_data = get_character_full_lines(play, character_id, lang)
        text = f"{'='*50}\n  {play_title}\n  {char_name}'s Lines\n{'='*50}\n\n"
        for scene in lines_data:
            text += f"--- {scene['scene_title']} ---\n\n"
            if scene.get('stage_direction'):
                text += f"({scene['stage_direction']})\n\n"
            for line in scene['lines']:
                if line['is_mine']:
                    text += f"  >>> {line['text']}\n\n"
                else:
                    text += f"  {line['character_emoji']} {line['character_name']}: {line['text']}\n"
            text += "\n"
    filename = f"{char_name}_lines_{'bilingual' if mode == 'bilingual' else lang}.txt"
    return Response(text, mimetype='text/plain; charset=utf-8',
                     headers={'Content-Disposition': f'attachment; filename={filename}'})

@app.route('/api/record', methods=['POST'])
def api_record():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file'}), 400
    audio = request.files['audio']
    play_id = request.form.get('play_id')
    character_id = request.form.get('character_id')
    scene_id = request.form.get('scene_id', 'all')
    player_name = request.form.get('player_name', 'Unknown')
    lang = request.form.get('lang', 'en')
    is_reference = int(request.form.get('is_reference', 0))
    ext = audio.filename.split('.')[-1] if '.' in audio.filename else 'webm'
    prefix = 'ref' if is_reference else 'rec'
    filename = f"{prefix}_{play_id}_{character_id}_{scene_id}_{lang}_{uuid.uuid4().hex[:6]}.{ext}"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    audio.save(filepath)
    rec_id = str(uuid.uuid4())[:8]
    db = get_db()
    db.execute('INSERT INTO recordings (id, play_id, character_id, scene_id, lang, file_path, player_name, is_reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
               (rec_id, play_id, character_id, scene_id, lang, filename, player_name, is_reference, datetime.now().isoformat()))
    db.commit()
    db.close()
    return jsonify({'success': True, 'recording_id': rec_id, 'filename': filename})

@app.route('/api/recordings/<int:play_id>/<character_id>')
def api_recordings(play_id, character_id):
    lang = request.args.get('lang', None)
    db = get_db()
    if lang:
        recs = db.execute('SELECT * FROM recordings WHERE play_id = ? AND character_id = ? AND lang = ? ORDER BY created_at', (play_id, character_id, lang)).fetchall()
    else:
        recs = db.execute('SELECT * FROM recordings WHERE play_id = ? AND character_id = ? ORDER BY created_at', (play_id, character_id)).fetchall()
    db.close()
    return jsonify([dict(r) for r in recs])

@app.route('/api/recording/<filename>')
def api_recording_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/score', methods=['POST'])
def api_score():
    data = request.json
    play_id = data.get('play_id')
    character_id = data.get('character_id')
    lang = data.get('lang', 'en')
    scene_id = data.get('scene_id', 'all')
    recognized_text = data.get('recognized_text', '').strip().lower()
    expected_text = data.get('expected_text', '').strip().lower()
    if not recognized_text or not expected_text:
        return jsonify({'error': 'Both recognized_text and expected_text are required'}), 400
    similarity = difflib.SequenceMatcher(None, recognized_text, expected_text).ratio()
    score = round(similarity * 100, 1)
    passed = score >= 80
    score_id = str(uuid.uuid4())[:8]
    db = get_db()
    db.execute('INSERT INTO scores (id, play_id, character_id, lang, scene_id, score, passed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
               (score_id, play_id, character_id, lang, scene_id, score, int(passed), datetime.now().isoformat()))
    db.commit()
    db.close()
    return jsonify({'score': score, 'passed': passed, 'threshold': 80, 'similarity': round(similarity, 3)})

@app.route('/api/scores/<int:play_id>/<character_id>')
def api_scores(play_id, character_id):
    db = get_db()
    scores = db.execute('SELECT * FROM scores WHERE play_id = ? AND character_id = ? ORDER BY created_at DESC LIMIT 10', (play_id, character_id)).fetchall()
    db.close()
    return jsonify([dict(s) for s in scores])

init_db()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
ENDOFFILE

echo "✅ app.py 创建完成"

# 4. 创建 plays.json
echo "📝 创建 plays.json..."
cat > ~/bilingual-play/data/plays.json << 'ENDOFFILE'
[
  {
    "id": 1,
    "title_en": "The Dinosaurs Next Door",
    "title_zh": "隔壁的恐龙",
    "cover_emoji": "🦕",
    "description_en": "A fun story about dinosaurs hatching next door! When the eccentric Mr. Puff moves in with a basket of dinosaur eggs, Amy and Tom discover that growing dinosaurs can be a BIG problem — and a BIG adventure!",
    "description_zh": "一个关于恐龙在隔壁孵出来的有趣故事！当古怪的帕夫先生带着一篮恐龙蛋搬来时，艾米和汤姆发现，长大的恐龙可能是个大麻烦——也是一场大冒险！",
    "characters": [
      {
        "id": "narrator",
        "name_en": "Narrator",
        "name_zh": "纳雷特",
        "personality_en": "Warm, storytelling",
        "personality_zh": "温和，讲故事的感觉",
        "color": "#8B5CF6",
        "emoji": "📖"
      },
      {
        "id": "amy",
        "name_en": "Amy",
        "name_zh": "艾米",
        "personality_en": "Curious, brave",
        "personality_zh": "好奇，勇敢",
        "color": "#EC4899",
        "emoji": "👧"
      },
      {
        "id": "tom",
        "name_en": "Tom",
        "name_zh": "汤姆",
        "personality_en": "Timid but sweet",
        "personality_zh": "胆小但可爱",
        "color": "#3B82F6",
        "emoji": "👦"
      },
      {
        "id": "mr_puff",
        "name_en": "Mr. Puff",
        "name_zh": "帕夫先生",
        "personality_en": "Eccentric, fun",
        "personality_zh": "古怪，有趣",
        "color": "#F59E0B",
        "emoji": "🎩"
      },
      {
        "id": "rex",
        "name_en": "Rex",
        "name_zh": "雷克斯",
        "personality_en": "Tough but gentle",
        "personality_zh": "霸气但温柔",
        "color": "#EF4444",
        "emoji": "🦖"
      },
      {
        "id": "daisy",
        "name_en": "Daisy",
        "name_zh": "黛西",
        "personality_en": "Playful, loves flowers",
        "personality_zh": "调皮，爱花",
        "color": "#10B981",
        "emoji": "🦕"
      }
    ],
    "scenes": [
      {
        "id": "opening",
        "number": 0,
        "title_en": "Opening",
        "title_zh": "开场",
        "stage_direction_en": "",
        "stage_direction_zh": "",
        "lines": [
          {"character_id": "narrator", "text_en": "Hello, everyone! Welcome to our play — \"The Dinosaurs Next Door\"! This is a story about a girl named Amy, and her little brother Tom. They live in a nice little house on Maple Street. One day, a very strange man moves in next door. His name is Mr. Puff, and he has a very BIG secret... And now... let the story begin!", "text_zh": "大家好！欢迎来到我们的小剧场——《隔壁的恐龙》！这个故事讲的是一个叫艾米的女孩，还有她的弟弟汤姆。他们住在枫叶街上一栋漂亮的小房子里。有一天，一个非常奇怪的人搬到了隔壁。他叫帕夫先生，他有一个很大的秘密……好了，故事开始啦！"}
        ]
      },
      {
        "id": "scene1",
        "number": 1,
        "title_en": "The New Neighbor",
        "title_zh": "新邻居",
        "stage_direction_en": "Amy and Tom are playing in their front yard. A moving truck pulls up next door.",
        "stage_direction_zh": "艾米和汤姆在前院玩耍。隔壁开来了一辆搬家卡车。",
        "lines": [
          {"character_id": "amy", "text_en": "Look! Someone's moving in next door!", "text_zh": "你看！隔壁搬来了新邻居！"},
          {"character_id": "tom", "text_en": "Do you think they have kids?", "text_zh": "他们家有没有小朋友呀？"},
          {"character_id": "narrator", "text_en": "Mr. Puff walks out carrying a big basket.", "text_zh": "帕夫先生提着一个大篮子走出来。"},
          {"character_id": "mr_puff", "text_en": "Hello there! I'm Mr. Puff, your new neighbor. Come on in and take a look!", "text_zh": "你们好呀！我是帕夫先生，你们的新邻居。快进来看看吧！"},
          {"character_id": "amy", "text_en": "Whoa, so many cool things! What's in the basket?", "text_zh": "哇，好多好玩的东西！篮子里是什么？"},
          {"character_id": "mr_puff", "text_en": "This? This is my most precious treasure — dinosaur eggs!", "text_zh": "这个？这是我最宝贝的东西——恐龙蛋！"},
          {"character_id": "tom", "text_en": "Dinosaur eggs?! Are you serious?!", "text_zh": "恐龙蛋？！真的假的？！"},
          {"character_id": "mr_puff", "text_en": "Of course I'm serious! Shh... don't tell anyone, okay?", "text_zh": "当然是真的！嘘——别告诉别人哦，好不好？"},
          {"character_id": "narrator", "text_en": "Amy and Tom couldn't believe it. Dinosaur eggs? In the house next door? They went home, but they couldn't stop thinking about those eggs...", "text_zh": "艾米和汤姆简直不敢相信。恐龙蛋？就在隔壁？他们回了家，但脑子里全是那些蛋……"}
        ]
      },
      {
        "id": "scene2",
        "number": 2,
        "title_en": "They're Hatching!",
        "title_zh": "孵出来了！",
        "stage_direction_en": "Late that night, strange sounds come from next door...",
        "stage_direction_zh": "深夜，隔壁传来奇怪的声音……",
        "lines": [
          {"character_id": "narrator", "text_en": "Late that night, Amy and Tom heard strange noises coming from next door...", "text_zh": "那天深夜，艾米和汤姆听到隔壁传来奇怪的声音……"},
          {"character_id": "amy", "text_en": "Did you hear that? Something's cracking!", "text_zh": "你听到了吗？有东西在裂开！"},
          {"character_id": "tom", "text_en": "I'm scared! What if it's a monster?", "text_zh": "我好害怕！要是怪物怎么办？"},
          {"character_id": "narrator", "text_en": "The eggs crack open. Rex and Daisy pop out.", "text_zh": "蛋壳裂开，雷克斯和黛西钻了出来。"},
          {"character_id": "rex", "text_en": "Whoa... how long was I asleep? Where am I?", "text_zh": "哇——我睡了多久啊？这是哪里？", "stage_direction_en": "stretching", "stage_direction_zh": "伸懒腰"},
          {"character_id": "daisy", "text_en": "It's so bright! Everything is so big! Ooh, what's that?", "text_zh": "好亮！什么都好大！咦，那是什么？", "stage_direction_en": "jumping around", "stage_direction_zh": "蹦蹦跳跳"},
          {"character_id": "mr_puff", "text_en": "Oh my goodness! You actually hatched!", "text_zh": "天哪！你们真的孵出来了！"},
          {"character_id": "amy", "text_en": "Aww, they're adorable! But... wait, are they getting bigger?", "text_zh": "好可爱！但是……等等，它们是不是在变大？"},
          {"character_id": "narrator", "text_en": "And Amy was right. The dinosaurs were growing — VERY fast!", "text_zh": "艾米说对了。恐龙们在长大——而且非常非常快！"}
        ]
      },
      {
        "id": "scene3",
        "number": 3,
        "title_en": "Growing Too Fast",
        "title_zh": "长得太快了！",
        "stage_direction_en": "A few days later, the dinosaurs are bigger than the house.",
        "stage_direction_zh": "几天后，恐龙比房子还大了。",
        "lines": [
          {"character_id": "narrator", "text_en": "A few days passed, and Rex and Daisy were HUGE. They couldn't even fit inside Mr. Puff's house anymore!", "text_zh": "几天过去了，雷克斯和黛西变得好大好大。它们已经塞不进帕夫先生的房子了！"},
          {"character_id": "rex", "text_en": "Mr. Puff, I can't fit through the door anymore!", "text_zh": "帕夫先生，我出不去了！门太小了！"},
          {"character_id": "mr_puff", "text_en": "Oh dear, oh dear... dinosaurs grow SO fast! What are we going to do?", "text_zh": "哎呀呀……恐龙长得太快了！怎么办呢？"},
          {"character_id": "tom", "text_en": "Maybe they can live in the backyard?", "text_zh": "也许它们可以住在后院？"},
          {"character_id": "amy", "text_en": "Good idea! But the backyard's too small. What about the park by the pond?", "text_zh": "好主意！但是后院太小了。池塘旁边的空地怎么样？"},
          {"character_id": "daisy", "text_en": "Can I have a garden? I love flowers!", "text_zh": "我可以有个花园吗？我最喜欢花！"},
          {"character_id": "rex", "text_en": "Can I have a swimming pool? I love water!", "text_zh": "我可以有个游泳池吗？我最喜欢玩水！"},
          {"character_id": "narrator", "text_en": "So everyone had an idea. Now they just needed to make it happen!", "text_zh": "大家都有了主意，现在只差动手做了！"}
        ]
      },
      {
        "id": "scene4",
        "number": 4,
        "title_en": "Let's Work Together",
        "title_zh": "一起动手",
        "stage_direction_en": "The next morning, everyone meets at the park.",
        "stage_direction_zh": "第二天早上，大家在空地集合了。",
        "lines": [
          {"character_id": "narrator", "text_en": "The next morning, everyone met at the park. Amy had a plan!", "text_zh": "第二天早上，大家在空地集合了。艾米有了一个计划！"},
          {"character_id": "amy", "text_en": "OK team, here's the plan! We'll build a dinosaur house near the pond!", "text_zh": "好了团队，计划是这样的！我们在池塘旁边给恐龙建一个家！"},
          {"character_id": "mr_puff", "text_en": "Amy, you draw the design! Tom, you can help me carry the wood!", "text_zh": "艾米，你来画设计图！汤姆，你帮我搬木头！"},
          {"character_id": "tom", "text_en": "I can do that!", "text_zh": "我可以！", "stage_direction_en": "picks up a small piece of wood", "stage_direction_zh": "搬起一块小木板"},
          {"character_id": "rex", "text_en": "I can carry the BIG stuff!", "text_zh": "大件的交给我！", "stage_direction_en": "picks up a huge log", "stage_direction_zh": "扛起一根大树干"},
          {"character_id": "daisy", "text_en": "I'll plant flowers to make it pretty!", "text_zh": "我来种花，让它变漂亮！", "stage_direction_en": "pretends to plant", "stage_direction_zh": "假装种花"},
          {"character_id": "mr_puff", "text_en": "When we all work together, we can do anything!", "text_zh": "大家一起努力，什么都能做到！"},
          {"character_id": "narrator", "text_en": "They worked all day long. And by sunset... it was done!", "text_zh": "他们干了一整天。等到太阳下山的时候……完成了！"}
        ]
      },
      {
        "id": "scene5",
        "number": 5,
        "title_en": "A Home for the Dinosaurs",
        "title_zh": "恐龙的家",
        "stage_direction_en": "The new home is ready! Everyone celebrates.",
        "stage_direction_zh": "新家建好了！大家开心庆祝。",
        "lines": [
          {"character_id": "narrator", "text_en": "The dinosaur house was amazing! It had a garden for Daisy, a pool for Rex, and a big sign that said \"HOME SWEET HOME.\"", "text_zh": "恐龙的房子太棒了！有黛西的花园，有雷克斯的游泳池，还有一块大牌子写着\"甜蜜的家\"。"},
          {"character_id": "rex", "text_en": "This is AWESOME! Best home ever!", "text_zh": "太棒了！这是最棒的家！"},
          {"character_id": "daisy", "text_en": "Thank you all! You're the best friends ever!", "text_zh": "谢谢你们！你们是我最好的朋友！"},
          {"character_id": "amy", "text_en": "We did it! We built a home for the dinosaurs!", "text_zh": "我们做到了！我们给恐龙建了一个家！"},
          {"character_id": "tom", "text_en": "Can we come over and play again tomorrow?", "text_zh": "我们明天还能来玩吗？"},
          {"character_id": "rex", "text_en": "Of course! Come over anytime!", "text_zh": "当然！随时都可以来！"},
          {"character_id": "daisy", "text_en": "And bring cookies next time!", "text_zh": "下次带饼干来哦！"},
          {"character_id": "mr_puff", "text_en": "My door is always open for friends! Now... who wants juice?", "text_zh": "我的门永远为朋友敞开！现在……谁想喝果汁？"},
          {"character_id": "narrator", "text_en": "ME! 🎉", "text_zh": "我要！🎉", "is_chorus": true},
          {"character_id": "narrator", "text_en": "And so, Rex and Daisy found a wonderful new home, and everyone on Maple Street lived happily ever after. The End!", "text_zh": "就这样，雷克斯和黛西找到了一个美好的新家，枫叶街上的每个人都过上了快乐的生活。故事结束！"}
        ]
      }
    ]
  }
]
ENDOFFILE

echo "✅ plays.json 创建完成"
echo ""
echo "🎭 部署脚本 Part 1 完成！请继续运行 Part 2"
