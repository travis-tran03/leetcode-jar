from flask import Flask, jsonify, request, send_from_directory, abort, Response
import os
from jar_data import JarData, DEFAULT_DB_PATH

app = Flask(__name__, static_folder='docs', static_url_path='')


@app.route('/')
def index():
    return send_from_directory('docs', 'index.html')


@app.route('/<path:path>')
def static_proxy(path):
    # serve static files from docs/
    return send_from_directory('docs', path)


@app.route('/api/ping')
def ping():
    return jsonify({'ok': True})


@app.route('/api/data')
def api_data():
    jar = JarData.load(DEFAULT_DB_PATH)
    return jsonify({'users': jar.users(), 'entries': jar.entries})


@app.route('/api/mark', methods=['POST'])
def api_mark():
    payload = request.get_json() or {}
    date = payload.get('date')
    user = payload.get('user')
    status = payload.get('status')
    if not all([date, user, status]):
        return jsonify({'error': 'missing fields'}), 400
    jar = JarData.load(DEFAULT_DB_PATH)
    try:
        jar.set_entry(date, user, status)
        jar.save(DEFAULT_DB_PATH)
    except KeyError:
        return jsonify({'error': 'unknown user'}), 400
    return jsonify({'ok': True})


@app.route('/api/close-day', methods=['POST'])
def api_close_day():
    payload = request.get_json() or {}
    date = payload.get('date')
    if not date:
        return jsonify({'error': 'missing date'}), 400
    jar = JarData.load(DEFAULT_DB_PATH)
    changed = jar.close_day(date)
    jar.save(DEFAULT_DB_PATH)
    return jsonify({'ok': True, 'changed': changed})


@app.route('/api/init', methods=['POST'])
def api_init():
    payload = request.get_json() or {}
    users = payload.get('users')
    if not isinstance(users, list):
        return jsonify({'error': 'users must be a list'}), 400
    jar = JarData()
    jar.init_users(users)
    jar.save(DEFAULT_DB_PATH)
    return jsonify({'ok': True})


@app.route('/api/export-csv')
def api_export_csv():
    jar = JarData.load(DEFAULT_DB_PATH)
    import io, csv
    si = io.StringIO()
    w = csv.writer(si)
    w.writerow(['date', 'user', 'status'])
    for d in sorted(jar.entries.keys()):
        for u, s in jar.entries[d].items():
            w.writerow([d, u, s])
    output = si.getvalue()
    return Response(output, mimetype='text/csv', headers={
        'Content-Disposition': 'attachment; filename=jar_history.csv'
    })


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
