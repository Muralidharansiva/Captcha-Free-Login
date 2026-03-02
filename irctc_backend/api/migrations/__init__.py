# api/__init__.py
try:
    from . import firebase  # initializes firebase on import (api/firebase.py)
except Exception:
    # avoid raising during manage.py commands, migrations, or import checks
    pass
