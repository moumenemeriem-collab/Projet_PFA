import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from django.db import connection
with connection.cursor() as cur:
    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='couche_plan_amenagement'")
    for r in cur.fetchall():
        print(r)
    cur.execute("SELECT COUNT(*) FROM couche_plan_amenagement")
    print('Total rows:', cur.fetchone()[0])
    cur.execute("SELECT DISTINCT designation FROM couche_plan_amenagement ORDER BY designation")
    print('Designations:', [r[0] for r in cur.fetchall()])
