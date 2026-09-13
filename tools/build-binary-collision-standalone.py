#!/usr/bin/env python3
"""Bundle the original ES modules and CSS into one offline, file://-safe HTML.
No minifier, npm install, font assets, network access, or build dependency needed.
"""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
LAB=ROOT/'demos/binary-collision'
def bundle_module(path, namespace):
    source=path.read_text(encoding='utf-8')
    names=re.findall(r'^export (?:const|class|function) (\w+)',source,re.M)
    source=re.sub(r'^export ', '', source, flags=re.M)
    return f'const {namespace}=(()=>{{\n{source}\nreturn {{{",".join(names)}}};\n}})();\n'
engine=bundle_module(ROOT/'lib/chalkish/src/collision-3d.js','Chalk3D')
physics=bundle_module(LAB/'physics.js','CollisionPhysics')
lessons=bundle_module(LAB/'chapters.js','CollisionLessons')
app=(LAB/'app.js').read_text(encoding='utf-8')
for module,namespace in [('collision-3d.js','Chalk3D'),('physics.js','CollisionPhysics'),('chapters.js','CollisionLessons')]:
    app=re.sub(r"import (\{[^\n]+\}) from '[^']*"+re.escape(module)+r"';",r'const \1='+namespace+';',app)
css=(LAB/'lab.css').read_text(encoding='utf-8')
html=(LAB/'index.html').read_text(encoding='utf-8')
html=html.replace('<link rel="stylesheet" href="lab.css">','<style>\n'+css+'\n</style>')
js=engine+physics+lessons+'\n(()=>{\n'+app+'\n})();'
html=html.replace('<script type="module" src="app.js"></script>','<script>\n"use strict";\n'+js.replace('</script','<\\/script')+'\n</script>')
out=ROOT/'binary-collision-lab.html'
out.write_text(html,encoding='utf-8')
print(f'{out}: {out.stat().st_size:,} bytes')
