# Bilingual Playhouse 部署指南 - PythonAnywhere

账号：Stella0930
部署后网址：https://stella0930.pythonanywhere.com

---

## 第一步：注册 PythonAnywhere 账号

1. 打开 https://www.pythonanywhere.com/registration/
2. 用 Stella0930 注册一个免费账号
3. 验证邮箱

## 第二步：上传项目文件

### 方法A：通过网页上传（推荐，最简单）

1. 登录 PythonAnywhere 后，点击顶部 **"Files"** 标签
2. 在文件列表中，点击 **"Open new file"** 或直接上传
3. 逐个上传以下文件：

需要创建的目录结构：
```
bilingual-play/
├── app.py
├── wsgi.py
├── requirements.txt
├── data/
│   └── plays.json
├── static/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── app.js
│   └── uploads/        (空目录)
└── templates/
    ├── index.html
    ├── play.html
    └── practice.html
```

### 方法B：通过 Git 上传（更快）

1. 在 PythonAnywhere 点击顶部 **"Consoles"** 标签
2. 点击 **"Bash"** 打开终端
3. 输入以下命令：

```bash
# 创建目录
mkdir -p ~/bilingual-play/data ~/bilingual-play/static/css ~/bilingual-play/static/js ~/bilingual-play/static/uploads ~/bilingual-play/templates

# 克隆或上传文件（如果放在 GitHub 上）
# 或者直接在网页上创建文件并粘贴内容
```

## 第三步：安装 Python 依赖

1. 在 PythonAnywhere 的 Bash 终端中输入：

```bash
pip install --user flask
```

## 第四步：配置 Web 应用

1. 点击顶部 **"Web"** 标签
2. 点击 **"Add a new web app"**
3. 选择你的域名：**stella0930.pythonanywhere.com**
4. 选择 **"Manual configuration"**（手动配置）
5. 选择 Python 版本：**Python 3.11**（或最新的3.x）

## 第五步：配置 Web 应用设置

在 Web 页面中，修改以下设置：

### 1. Code 部分
- **Source code**: `/home/Stella0930/bilingual-play`
- **Working directory**: `/home/Stella0930/bilingual-play`

### 2. WSGI 配置
- 点击 WSGI 配置文件的链接（类似 `/var/www/stella0930_pythonanywhere_com_wsgi.py`）
- 把内容替换为：

```python
import sys
import os

project_dir = '/home/Stella0930/bilingual-play'
if project_dir not in sys.path:
    sys.path.insert(0, project_dir)

from app import app as application
```

### 3. Virtualenv（如果用了虚拟环境）
- 如果没有用虚拟环境，这个可以留空

## 第六步：重启 Web 应用

1. 回到 **Web** 页面
2. 点击顶部绿色的 **"Reload stella0930.pythonanywhere.com"** 按钮
3. 等几秒钟

## 第七步：测试访问

打开浏览器，访问：
**https://stella0930.pythonanywhere.com**

---

## 常见问题

### Q: 页面显示 404？
检查 WSGI 文件路径是否正确，确认 app.py 在正确位置。

### Q: 页面显示 500 错误？
1. 在 Web 页面查看 Error log
2. 检查 plays.json 是否在 data/ 目录下
3. 检查 static/uploads/ 目录是否存在

### Q: 录音功能不工作？
PythonAnywhere 免费版不支持 HTTPS，但录音功能需要 HTTPS 才能在浏览器中使用。
解决方案：
- 可以在 Cloudflare 上开启免费 SSL
- 或者升级 PythonAnywhere 付费版（$5/月）

### Q: 免费版有限制吗？
- 每天有 CPU 秒数限制（100秒/天），对于小规模使用完全够
- 每月 3GB 带宽
- 不能自定义域名

---

## 更新网站内容

以后要修改剧本，只需要：
1. 登录 PythonAnywhere
2. 进入 Files 页面
3. 编辑 `bilingual-play/data/plays.json`
4. 回到 Web 页面，点 Reload

---

## 快速部署脚本

如果你能在 Bash 终端中操作，可以直接复制粘贴以下命令：

```bash
# 创建目录结构
mkdir -p ~/bilingual-play/{data,static/{css,js,uploads},templates}

# 安装依赖
pip install --user flask

# 然后把文件内容逐个粘贴进去
```
