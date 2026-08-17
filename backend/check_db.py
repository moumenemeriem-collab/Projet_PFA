import os, sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()
from django.db import connection
with connection.cursor() as cur:
    cur.execute("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='rentabilite')")
    print('rentabilite table exists:', cur.fetchone()[0])
    cur.execute("SELECT count(*) FROM couche_cadastre")
    print('parcelles cadastre count:', cur.fetchone()[0])
    try:
        cur.execute("SELECT statement_timeout FROM pg_settings WHERE name='statement_timeout'")
        print('statement_timeout:', cur.fetchone()[0])
    except Exception:
        pass
    try:
        cur.execute("SELECT pid, state, query_start, now()-query_start as duration FROM pg_stat_activity WHERE state='active' ORDER BY duration DESC LIMIT 5")
        rows = cur.fetchall()
        print('Active queries:', len(rows))
        for r in rows:
            print(f'  pid={r[0]} state={r[1]} duration={r[3]}')
    except Exception:
        pass
