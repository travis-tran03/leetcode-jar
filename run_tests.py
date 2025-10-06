import sys
import traceback
from importlib import import_module


def run():
    sys.path.insert(0, '.')
    mod = import_module('tests.test_jar')
    failures = 0
    for name in dir(mod):
        if name.startswith('test_'):
            fn = getattr(mod, name)
            try:
                fn()
                print(f"PASS {name}")
            except Exception:
                failures += 1
                print(f"FAIL {name}")
                traceback.print_exc()
    if failures:
        print(f"{failures} tests failed")
        sys.exit(1)
    print("All tests passed")


if __name__ == '__main__':
    run()
