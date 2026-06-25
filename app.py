from flask import Flask, render_template, request, jsonify, send_from_directory, send_file, Response, session
import json, os, sqlite3, uuid, difflib
from datetime import datetime
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'bilingual-playhouse-dev-key-2026')
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'static', 'uploads')
app.config['DATABASE'] = os.path.join(os.path.dirname(__file__), 'data', 'bilingual.db')
app.config['PLAYS_FILE'] = os.path.join(os.path.dirname(__file__), 'data', 'plays.json')

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# ---------- Database ----------

def get_db():
    db = sqlite3.connect(app.config['DATABASE'])
    db.row_factory = sqlite3.Row
    return db

def init_db():
    db = get_db()
    db.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nickname TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            age INTEGER,
            room TEXT,
            is_admin INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        );
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
            line_index INTEGER DEFAULT -1,
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
    # Migrations
    for stmt in [
        'ALTER TABLE recordings ADD COLUMN line_index INTEGER DEFAULT -1',
        'ALTER TABLE role_claims ADD COLUMN user_id INTEGER REFERENCES users(id)',
        'ALTER TABLE recordings ADD COLUMN user_id INTEGER REFERENCES users(id)',
        'ALTER TABLE scores ADD COLUMN user_id INTEGER REFERENCES users(id)',
        'ALTER TABLE recordings ADD COLUMN audio_label TEXT DEFAULT \'\'',
        'ALTER TABLE recordings ADD COLUMN is_bulk INTEGER DEFAULT 0',
        'ALTER TABLE recordings ADD COLUMN timestamps_json TEXT DEFAULT \'\'',
    ]:
        try:
            db.execute(stmt)
        except:
            pass
    db.commit()
    db.close()

# ---------- Auth Helpers ----------

def current_user():
    """Return the logged-in user dict or None."""
    user_id = session.get('user_id')
    if not user_id:
        return None
    db = get_db()
    user = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    db.close()
    return dict(user) if user else None

def login_required(f):
    """Decorator: return 401 if not logged in."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('user_id'):
            return jsonify({'error': 'Login required / 请先登录'}), 401
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    """Decorator: return 403 if not admin."""
    @wraps(f)
    def decorated(*args, **kwargs):
        user = current_user()
        if not user:
            return jsonify({'error': 'Login required / 请先登录'}), 401
        if not user['is_admin']:
            return jsonify({'error': 'Admin access only / 仅管理员可访问'}), 403
        return f(*args, **kwargs)
    return decorated

# ---------- Helpers ----------

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
    """Get full script with the character's lines highlighted."""
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
            # Also include the other language for reference
            other_lang = 'zh' if lang == 'en' else 'en'
            line_data['text_other'] = line.get(f'text_{other_lang}', line.get('text_en', ''))
            sd = line.get(f'stage_direction_{lang}', line.get('stage_direction_en', ''))
            if sd:
                line_data['stage_direction'] = sd
            scene_data['lines'].append(line_data)
        result.append(scene_data)
    return result

def get_character_mylines_only(play, character_id, lang):
    """Get only the character's own lines with both languages."""
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

# ---------- Routes ----------

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/play/<int:play_id>')
def play_page(play_id):
    return render_template('play.html', play_id=play_id)

@app.route('/practice/<int:play_id>/<character_id>')
def practice_page(play_id, character_id):
    return render_template('practice.html', play_id=play_id, character_id=character_id)

@app.route('/watch/<int:play_id>')
def watch_page(play_id):
    return render_template('watch.html', play_id=play_id)

@app.route('/admin')
def admin_page():
    return render_template('admin.html')

# ---------- API ----------

# ---- Auth APIs ----

@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.json
    nickname = data.get('nickname', '').strip()
    password = data.get('password', '')
    age = data.get('age')
    room = data.get('room', '').strip()

    if not nickname or len(nickname) > 20:
        return jsonify({'error': 'Nickname is required (max 20 chars) / 昵称必填（最多20字）'}), 400
    if len(password) < 4:
        return jsonify({'error': 'Password must be at least 4 chars / 密码至少4位'}), 400
    if age is not None:
        try:
            age = int(age)
        except:
            age = None

    db = get_db()
    existing = db.execute('SELECT id FROM users WHERE nickname = ?', (nickname,)).fetchone()
    if existing:
        db.close()
        return jsonify({'error': 'Nickname already taken / 昵称已被使用'}), 409

    pw_hash = generate_password_hash(password)
    db.execute('INSERT INTO users (nickname, password_hash, age, room, created_at) VALUES (?, ?, ?, ?, ?)',
               (nickname, pw_hash, age, room, datetime.now().isoformat()))
    user = db.execute('SELECT * FROM users WHERE nickname = ?', (nickname,)).fetchone()
    db.commit()
    db.close()

    # Auto-login
    session['user_id'] = user['id']
    return jsonify({'success': True, 'user': {'id': user['id'], 'nickname': user['nickname'], 'age': user['age'], 'room': user['room'], 'is_admin': user['is_admin']}})

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.json
    nickname = data.get('nickname', '').strip()
    password = data.get('password', '')

    if not nickname or not password:
        return jsonify({'error': 'Nickname and password required / 请输入昵称和密码'}), 400

    db = get_db()
    user = db.execute('SELECT * FROM users WHERE nickname = ?', (nickname,)).fetchone()
    db.close()

    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({'error': 'Invalid nickname or password / 昵称或密码错误'}), 401

    session['user_id'] = user['id']
    return jsonify({'success': True, 'user': {'id': user['id'], 'nickname': user['nickname'], 'age': user['age'], 'room': user['room'], 'is_admin': user['is_admin']}})

@app.route('/api/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/me')
def api_me():
    user = current_user()
    if user:
        return jsonify({'logged_in': True, 'user': {'id': user['id'], 'nickname': user['nickname'], 'age': user['age'], 'room': user['room'], 'is_admin': user['is_admin']}})
    return jsonify({'logged_in': False})

@app.route('/api/admin-promote', methods=['POST'])
def api_admin_promote():
    """One-time setup: promote a user to admin using a setup key."""
    data = request.json
    nickname = data.get('nickname', '').strip()
    setup_key = data.get('setup_key', '')

    expected_key = os.environ.get('ADMIN_SETUP_KEY', 'playhouse2026')
    if setup_key != expected_key:
        return jsonify({'error': 'Invalid setup key / 设置密钥错误'}), 403

    db = get_db()
    user = db.execute('SELECT * FROM users WHERE nickname = ?', (nickname,)).fetchone()
    if not user:
        db.close()
        return jsonify({'error': 'User not found / 用户不存在'}), 404

    db.execute('UPDATE users SET is_admin = 1 WHERE id = ?', (user['id'],))
    db.commit()
    db.close()
    return jsonify({'success': True, 'message': f'{nickname} is now admin / 已设为管理员'})

@app.route('/api/admin/stats')
@admin_required
def api_admin_stats():
    """Admin-only: get character claim statistics with user details."""
    plays = load_plays()
    db = get_db()
    claims = db.execute('''
        SELECT rc.*, u.nickname as user_nickname, u.age as user_age, u.room as user_room
        FROM role_claims rc
        LEFT JOIN users u ON rc.user_id = u.id
        ORDER BY rc.play_id, rc.character_id
    ''').fetchall()
    users = db.execute('SELECT id, nickname, age, room, is_admin, created_at FROM users ORDER BY created_at').fetchall()
    db.close()

    plays_data = []
    for play in plays:
        chars_data = []
        for char in play['characters']:
            char_claims = [dict(c) for c in claims if c['play_id'] == play['id'] and c['character_id'] == char['id']]
            chars_data.append({
                'character_id': char['id'],
                'character_name_en': char.get('name_en', ''),
                'character_name_zh': char.get('name_zh', ''),
                'emoji': char.get('emoji', ''),
                'claimed_by': char_claims
            })
        plays_data.append({
            'play_id': play['id'],
            'title_en': play.get('title_en', ''),
            'title_zh': play.get('title_zh', ''),
            'characters': chars_data
        })

    return jsonify({
        'plays': plays_data,
        'users': [dict(u) for u in users],
        'total_users': len(users),
        'total_claims': len(claims)
    })

# ---- Play APIs ----

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
    db.close()
    # Group claims by character_id
    from collections import defaultdict
    claims_by_char = defaultdict(list)
    for c in claims:
        claims_by_char[c['character_id']].append(dict(c))
    for char in play['characters']:
        char_claims = claims_by_char.get(char['id'], [])
        char['claim_count'] = len(char_claims)
        char['claimed_by_list'] = [{'claim_id': c['id'], 'player_name': c['player_name'], 'user_id': c.get('user_id')} for c in char_claims]
        # Keep backward compat
        char['claimed_by'] = ', '.join(c['player_name'] for c in char_claims) if char_claims else None
        char['claim_id'] = char_claims[0]['id'] if char_claims else None
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
    # Prevent duplicate claims: same person can't claim the same role twice
    user = current_user()
    user_id = user['id'] if user else None
    if user_id:
        existing = db.execute('SELECT * FROM role_claims WHERE play_id = ? AND character_id = ? AND user_id = ?',
                              (play_id, character_id, user_id)).fetchone()
        if existing:
            db.close()
            return jsonify({'error': 'You already claimed this role / 你已经认领了这个角色'}), 409
    else:
        # For non-logged-in users, check by player_name
        existing = db.execute('SELECT * FROM role_claims WHERE play_id = ? AND character_id = ? AND player_name = ?',
                              (play_id, character_id, player_name)).fetchone()
        if existing:
            db.close()
            return jsonify({'error': 'You already claimed this role / 你已经认领了这个角色'}), 409

    claim_id = str(uuid.uuid4())[:8]
    # If logged in, use nickname as player_name
    if user and not player_name:
        player_name = user['nickname']
    db.execute('INSERT INTO role_claims (id, play_id, character_id, player_name, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
               (claim_id, play_id, character_id, player_name, user_id, datetime.now().isoformat()))
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
    return jsonify({
        'character': char,
        'scenes': lines,
        'lang': lang
    })

@app.route('/api/lines-bilingual/<int:play_id>/<character_id>')
def api_lines_bilingual(play_id, character_id):
    """Return bilingual (EN+ZH side by side) lines for a character."""
    play = get_play(play_id)
    if not play:
        return jsonify({'error': 'Play not found'}), 404
    lines = get_character_mylines_only(play, character_id, 'en')
    char = None
    for c in play['characters']:
        if c['id'] == character_id:
            char = c
            break
    return jsonify({
        'character': char,
        'scenes': lines
    })

@app.route('/api/lines-text/<int:play_id>/<character_id>')
def api_lines_text(play_id, character_id):
    """Return plain text for download/print."""
    play = get_play(play_id)
    if not play:
        return jsonify({'error': 'Play not found'}), 404
    lang = request.args.get('lang', 'en')
    mode = request.args.get('mode', 'single')  # 'single' or 'bilingual'

    char = None
    for c in play['characters']:
        if c['id'] == character_id:
            char = c
            break
    char_name = char.get(f'name_{lang}', char.get('name_en', '')) if char else ''
    play_title = play.get(f'title_{lang}', play.get('title_en', ''))

    if mode == 'bilingual':
        # Bilingual document - EN and ZH side by side
        lines_data = get_character_mylines_only(play, character_id, 'en')
        text = f"{'='*60}\n"
        text += f"  {play['title_en']} / {play['title_zh']}\n"
        text += f"  {char['name_en']} ({char['name_zh']})'s Lines\n"
        text += f"  Bilingual Edition / 中英对照版\n"
        text += f"{'='*60}\n\n"

        for scene in lines_data:
            text += f"--- {scene['scene_title_en']} / {scene['scene_title_zh']} ---\n\n"
            for line in scene['lines']:
                if line.get('stage_direction_en') or line.get('stage_direction_zh'):
                    sd_en = line.get('stage_direction_en', '')
                    sd_zh = line.get('stage_direction_zh', '')
                    if sd_en:
                        text += f"  ({sd_en}"
                        if sd_zh:
                            text += f" / {sd_zh}"
                        text += ")\n"
                text += f"  EN: {line['text_en']}\n"
                text += f"  ZH: {line['text_zh']}\n\n"
    else:
        # Single language
        lines_data = get_character_full_lines(play, character_id, lang)
        text = f"{'='*50}\n"
        text += f"  {play_title}\n"
        text += f"  {char_name}'s Lines ({'English' if lang == 'en' else '中文'})\n"
        text += f"{'='*50}\n\n"

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
    line_index = int(request.form.get('line_index', -1))
    player_name = request.form.get('player_name', 'Unknown')
    lang = request.form.get('lang', 'en')
    is_reference = int(request.form.get('is_reference', 0))
    audio_label = request.form.get('audio_label', '').strip()

    # Only admins can upload reference audio
    if is_reference:
        user = current_user()
        if not user or not user['is_admin']:
            return jsonify({'error': 'Only admins can upload reference audio / 只有管理员才能上传标准读音'}), 403

    ext = audio.filename.split('.')[-1] if '.' in audio.filename else 'webm'
    prefix = 'ref' if is_reference else 'rec'
    filename = f"{prefix}_{play_id}_{character_id}_{scene_id}_{lang}_{uuid.uuid4().hex[:6]}.{ext}"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    audio.save(filepath)

    rec_id = str(uuid.uuid4())[:8]
    user = current_user()
    user_id = user['id'] if user else None
    # If logged in, use nickname as player_name default
    if user and player_name == 'Unknown':
        player_name = user['nickname']
    db = get_db()
    db.execute('INSERT INTO recordings (id, play_id, character_id, scene_id, line_index, lang, file_path, player_name, is_reference, user_id, audio_label, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
               (rec_id, play_id, character_id, scene_id, line_index, lang, filename, player_name, is_reference, user_id, audio_label, datetime.now().isoformat()))
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

@app.route('/api/reference-audio/<int:play_id>')
def api_reference_audio(play_id):
    """Get all reference recordings for a play, organized by character+line+lang."""
    lang = request.args.get('lang', None)
    db = get_db()
    if lang:
        recs = db.execute('SELECT * FROM recordings WHERE play_id = ? AND is_reference = 1 AND lang = ? ORDER BY created_at', (play_id, lang)).fetchall()
    else:
        recs = db.execute('SELECT * FROM recordings WHERE play_id = ? AND is_reference = 1 ORDER BY created_at', (play_id,)).fetchall()
    db.close()
    # Group by character_id + line_index + lang, then by audio_label
    grouped = {}
    for r in recs:
        key = f"{r['character_id']}|{r['line_index']}|{r['lang']}"
        label = r['audio_label'] or 'default'
        if key not in grouped:
            grouped[key] = {}
        rec_dict = dict(r)
        # Include bulk audio info
        if rec_dict.get('is_bulk') and rec_dict.get('timestamps_json'):
            import json as json_mod
            try:
                rec_dict['bulk'] = True
                rec_dict['timestamps'] = json_mod.loads(rec_dict['timestamps_json'])
                rec_dict['line_index'] = r['line_index']
            except:
                pass
        # Take the latest for each label
        grouped[key][label] = rec_dict
    return jsonify(grouped)

@app.route('/api/audio-labels/<int:play_id>')
def api_audio_labels(play_id):
    """Get all unique audio labels used in a play's reference recordings."""
    db = get_db()
    recs = db.execute('SELECT DISTINCT audio_label FROM recordings WHERE play_id = ? AND is_reference = 1 AND audio_label != \'\'', (play_id,)).fetchall()
    db.close()
    labels = [r['audio_label'] for r in recs]
    return jsonify(labels)

@app.route('/api/cleanup-audio/<int:play_id>', methods=['POST'])
@admin_required
def api_cleanup_audio(play_id):
    """Delete all reference recordings except Amy朗读版 and Tom朗读版."""
    ALLOWED = ['Amy朗读版', 'Tom朗读版']
    db = get_db()
    # Delete recordings not in the allowed list
    placeholders = ','.join(['?'] * len(ALLOWED))
    result = db.execute(
        f'DELETE FROM recordings WHERE play_id = ? AND is_reference = 1 AND audio_label NOT IN ({placeholders})',
        [play_id] + ALLOWED
    )
    deleted = result.rowcount
    db.commit()
    db.close()
    return jsonify({'success': True, 'deleted': deleted})

@app.route('/api/bulk-upload', methods=['POST'])
@admin_required
def api_bulk_upload():
    """Upload a full audio recording, use Whisper API to transcribe and split into lines."""
    import requests as req_lib

    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file / 没有音频文件'}), 400

    audio = request.files['audio']
    play_id = int(request.form.get('play_id'))
    label = request.form.get('label', '').strip()
    lang = request.form.get('lang', 'en')

    if not label:
        return jsonify({'error': 'Label required / 需要版本名称'}), 400

    # Get OpenAI API key
    api_key = os.environ.get('OPENAI_API_KEY', '')
    if not api_key:
        return jsonify({'error': 'OPENAI_API_KEY not set on server / 服务器未设置 OpenAI API Key，请联系管理员'}), 500

    # Save the audio file
    ext = audio.filename.split('.')[-1] if '.' in audio.filename else 'mp3'
    filename = f"bulk_{play_id}_{label}_{lang}_{uuid.uuid4().hex[:6]}.{ext}"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    audio.save(filepath)

    # Get all script lines for this play (in order)
    play = get_play(play_id)
    all_lines = []
    for scene in play['scenes']:
        for line in scene['lines']:
            text = line['text_en'] if lang == 'en' else line['text_zh']
            all_lines.append({
                'character_id': line['character_id'],
                'scene_id': scene['id'],
                'text': text
            })

    total_lines = len(all_lines)

    # Call Whisper API for transcription with timestamps
    try:
        with open(filepath, 'rb') as f:
            files = {'file': (filename, f, 'audio/mpeg')}
            data = {
                'model': 'whisper-1',
                'response_format': 'verbose_json',
                'timestamp_granularities[]': 'word',
            }
            if lang == 'zh':
                data['language'] = 'zh'
            else:
                data['language'] = 'en'

            headers = {'Authorization': f'Bearer {api_key}'}
            resp = req_lib.post(
                'https://api.openai.com/v1/audio/transcriptions',
                files=files, data=data, headers=headers, timeout=120
            )
    except Exception as e:
        return jsonify({'error': f'Whisper API request failed: {str(e)}'}), 500

    if resp.status_code != 200:
        return jsonify({'error': f'Whisper API error: {resp.text}'}), 500

    result = resp.json()
    words = result.get('words', [])

    if not words:
        return jsonify({'error': 'No words detected in audio / 音频中未检测到语音'}), 400

    # Match each script line to word timestamps using text similarity
    # Build a continuous word list with cumulative text for matching
    word_texts = [w['word'].strip().lower().strip('.,!?;:"\'') for w in words]
    word_starts = [w['start'] for w in words]
    word_ends = [w['end'] for w in words]

    # For each script line, find the best matching word range
    timestamps = {}
    search_start = 0  # monotonic forward search (lines are in order)

    for line_idx, line_info in enumerate(all_lines):
        line_text = line_info['text'].lower().strip()
        # Normalize: remove punctuation for matching
        import re
        line_clean = re.sub(r'[^\w\s]', '', line_text).split()
        if not line_clean:
            continue

        best_score = 0
        best_start_idx = search_start
        best_end_idx = search_start

        # Search forward from current position
        for start_w in range(search_start, min(search_start + 80, len(word_texts))):
            # Try matching N words starting from start_w
            matched_count = 0
            for i, target_word in enumerate(line_clean):
                if start_w + i >= len(word_texts):
                    break
                # Fuzzy match: check if target_word is contained in word or vice versa
                wt = word_texts[start_w + i]
                if target_word in wt or wt in target_word or difflib.SequenceMatcher(None, target_word, wt).ratio() > 0.7:
                    matched_count += 1
                else:
                    break

            score = matched_count / len(line_clean) if line_clean else 0
            if score > best_score:
                best_score = score
                best_start_idx = start_w
                best_end_idx = min(start_w + len(line_clean) - 1, len(word_texts) - 1)

        # If good match found, record timestamps
        if best_score > 0.3:
            timestamps[line_idx] = {
                'start': word_starts[best_start_idx],
                'end': word_ends[best_end_idx]
            }
            # Move search forward
            search_start = best_end_idx + 1

    matched_lines = len(timestamps)

    # Store as a single bulk recording entry
    rec_id = str(uuid.uuid4())[:8]
    user = current_user()
    db = get_db()

    # Delete old bulk recordings with same play_id + label + lang
    db.execute('DELETE FROM recordings WHERE play_id = ? AND audio_label = ? AND lang = ? AND is_bulk = 1',
               (play_id, label, lang))

    # Insert one entry per matched line (so reference-audio API can serve them)
    import json as json_mod
    ts_json = json_mod.dumps(timestamps)
    for line_idx, ts in timestamps.items():
        line_info = all_lines[line_idx]
        line_rec_id = str(uuid.uuid4())[:8]
        db.execute(
            'INSERT INTO recordings (id, play_id, character_id, scene_id, line_index, lang, file_path, player_name, is_reference, user_id, audio_label, is_bulk, timestamps_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (line_rec_id, play_id, line_info['character_id'], line_info['scene_id'], line_idx, lang, filename, label, 1, user['id'], label, 1, json_mod.dumps(ts), datetime.now().isoformat())
        )

    db.commit()
    db.close()

    return jsonify({
        'success': True,
        'label': label,
        'lang': lang,
        'matched_lines': matched_lines,
        'total_lines': total_lines,
        'filename': filename
    })

@app.route('/api/score', methods=['POST'])
def api_score():
    """Score a practice recording against the expected text using speech recognition simulation."""
    data = request.json
    play_id = data.get('play_id')
    character_id = data.get('character_id')
    lang = data.get('lang', 'en')
    scene_id = data.get('scene_id', 'all')
    recognized_text = data.get('recognized_text', '').strip().lower()
    expected_text = data.get('expected_text', '').strip().lower()

    if not recognized_text or not expected_text:
        return jsonify({'error': 'Both recognized_text and expected_text are required'}), 400

    # Calculate similarity using difflib
    similarity = difflib.SequenceMatcher(None, recognized_text, expected_text).ratio()
    score = round(similarity * 100, 1)
    passed = score >= 80

    # Save score
    score_id = str(uuid.uuid4())[:8]
    user = current_user()
    user_id = user['id'] if user else None
    db = get_db()
    db.execute('INSERT INTO scores (id, play_id, character_id, lang, scene_id, score, passed, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
               (score_id, play_id, character_id, lang, scene_id, score, int(passed), user_id, datetime.now().isoformat()))
    db.commit()
    db.close()

    return jsonify({
        'score': score,
        'passed': passed,
        'threshold': 80,
        'similarity': round(similarity, 3)
    })

@app.route('/api/scores/<int:play_id>/<character_id>')
def api_scores(play_id, character_id):
    db = get_db()
    scores = db.execute('SELECT * FROM scores WHERE play_id = ? AND character_id = ? ORDER BY created_at DESC LIMIT 10', (play_id, character_id)).fetchall()
    db.close()
    return jsonify([dict(s) for s in scores])

# ---------- Init ----------

init_db()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
