#!/usr/bin/env python3
"""Optional browser QA. Requires Python Playwright and a Chromium executable.
Run from any directory: python tests/binary-collision-browser-smoke.py
Default: standalone inline HTML. Use --http to exercise ES modules through a
loopback-only server when local navigation is permitted by browser policy.
"""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
import threading,json,os,shutil,sys
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/demos/binary-collision/'
http_mode='--http' in sys.argv
report={'checks':[],'errors':[],'network_failures':[],'browser':'','delivery_mode':'ES modules over loopback HTTP' if http_mode else 'standalone inline HTML (browser navigation policy restricts local URLs)'}
def check(name,value):
    report['checks'].append({'name':name,'passed':bool(value)})
    if not value: raise AssertionError(name)
preview=ROOT/'previews';preview.mkdir(exist_ok=True)
try:
  with sync_playwright() as p:
    executable=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome')
    browser=p.chromium.launch(executable_path=executable,headless=True,args=['--no-sandbox'])
    report['browser']=browser.version
    page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1,accept_downloads=True)
    page.on('pageerror',lambda e:report['errors'].append(str(e)))
    page.on('requestfailed',lambda r:report['network_failures'].append({'url':r.url,'failure':r.failure}))
    if http_mode: page.goto(base,wait_until='networkidle')
    else: page.set_content((ROOT/'binary-collision-lab.html').read_text())
    page.wait_for_function('typeof collisionLab !== "undefined"')
    check('application initializes',page.evaluate('collisionLab.getState().chapter===0'))
    for c in range(9):
      for s in range(3):
        page.evaluate('([c,s])=>collisionLab.go(c,s)',[c,s]);page.wait_for_timeout(65)
        check(f'chapter {c+1}, step {s+1}: finite successful simulation',page.evaluate('(()=>{const d=collisionLab.getDiagnostics();return d.status==="ok"&&Number.isFinite(d.chi)&&Number.isFinite(d.errorE)})()'))
    page.evaluate('collisionLab.go(5,0)')
    for model in ['hs','ipl','sutherland','lj','coulomb']:
      page.select_option('#model',model)
      for E,b in [(.08,0),(.08,3.1),(8,0),(8,3.1)]:
        page.evaluate('([E,b])=>{collisionLab.set("E",E);collisionLab.set("b",b)}',[E,b]);page.wait_for_timeout(20)
        check(f'potential {model}, E={E}, b={b}: valid trajectory',page.evaluate('collisionLab.getDiagnostics().status==="ok"'))
    page.evaluate('collisionLab.go(6,1)')
    for preset in ['weak','rainbow','orbit']:
      page.locator(f'[data-preset="{preset}"]').click();page.wait_for_timeout(90)
      check(f'{preset} preset computes',page.evaluate('collisionLab.getDiagnostics().status==="ok"'))
    page.locator('[data-plot="dcs"]').click();page.wait_for_timeout(90)
    check('angular cross-section plot toggle',page.evaluate('collisionLab.getState().plotMode==="dcs"'))
    page.click('#view3d');page.click('#perspective');page.wait_for_timeout(80)
    check('perspective camera toggles',page.locator('#perspective').get_attribute('aria-pressed')=='true')
    page.click('#viewPlane');page.click('#viewFront');page.click('#view3d');page.click('#perspective')
    canvas=page.locator('#stage').bounding_box();x=canvas['x']+canvas['width']*.55;y=canvas['y']+canvas['height']*.6
    page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+80,y+35,steps=8);page.mouse.up();page.mouse.wheel(0,-100);page.wait_for_timeout(100)
    check('orbit and zoom interaction has no runtime errors',len(report['errors'])==0)
    page.evaluate('collisionLab.go(5,1)');page.click('#exploreButton');page.fill('#exactB','0.7321');page.press('#exactB','Tab');page.wait_for_timeout(50)
    check('precise numerical input applied',abs(page.evaluate('collisionLab.getState().b')-.7321)<1e-12)
    page.click('#playButton');before=page.evaluate('collisionLab.getState().time');page.wait_for_timeout(300);after=page.evaluate('collisionLab.getState().time');page.click('#playButton')
    check('playback advances simulation time',after>before)
    page.focus('#stage');page.keyboard.press('ArrowRight');check('keyboard next-step navigation',page.evaluate('collisionLab.getState().step===2'))
    page.click('#helpButton');check('help dialog opens',page.locator('#helpDialog').evaluate('(e)=>e.open'));page.click('#closeHelp')
    page.click('#projectorButton');check('projector contrast toggle',page.locator('body').evaluate('(e)=>e.classList.contains("projector")'));page.click('#projectorButton')
    page.evaluate('collisionLab.go(7,1)');page.select_option('#count','2400');page.check('#wrongSampling');page.wait_for_timeout(80)
    check('incorrect-sampling teaching switch and maximum ensemble size',page.evaluate('collisionLab.getState().wrongSampling && collisionLab.getState().count===2400'))
    page.uncheck('#wrongSampling');oldseed=page.evaluate('collisionLab.getState().seed');page.click('#seedButton');check('new reproducible seed',page.evaluate('collisionLab.getState().seed')!=oldseed)
    page.evaluate('collisionLab.go(8,2)');page.select_option('#collisionModel','vss');page.evaluate('collisionLab.set("alpha",2.2)')
    with page.expect_download() as di: page.click('#exportButton')
    download=di.value;download.save_as(str(ROOT/'tests'/'sample-ensemble.csv'))
    text=(ROOT/'tests'/'sample-ensemble.csv').read_text()
    check('CSV export is real and contains bin indices',('cos_chi_bin_0_based' in text) and len(text.splitlines())>800)
    page.click('#linkButton');url=page.url
    if http_mode:
      page.reload(wait_until='networkidle')
      check('URL-state reload restores chapter and alpha',page.evaluate('collisionLab.getState().chapter===8 && collisionLab.getState().alpha===2.2'))
    else:
      restored=browser.new_page();restored.evaluate('(h)=>location.hash=h',page.evaluate('location.hash'))
      restored.set_content((ROOT/'binary-collision-lab.html').read_text());restored.wait_for_timeout(100)
      check('URL-state initialization restores chapter and alpha',restored.evaluate('collisionLab.getState().chapter===8 && collisionLab.getState().alpha===2.2'));restored.close()
    report['final_diagnostic_energy_error']=page.evaluate('collisionLab.getDiagnostics().errorE')
    for c,s,name in [(1,1,'02-cylinder.png'),(2,2,'03-impact.png'),(3,2,'04-angles.png'),(4,2,'05-cross-section.png'),(5,1,'06-potential.png'),(6,2,'07-orbiting.png'),(7,1,'08-ensemble.png'),(8,2,'09-vss.png')]:
      page.evaluate('([c,s])=>collisionLab.go(c,s)',[c,s]);page.wait_for_timeout(120);page.screenshot(path=str(preview/name))
    for width,height in [(1440,900),(1024,768)]:
      page.set_viewport_size({'width':width,'height':height});page.evaluate('collisionLab.go(4,2)');page.wait_for_timeout(130)
      layout=page.evaluate('({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,canvasHeight:document.querySelector("#stage").clientHeight})')
      check(f'{width}×{height} fits viewport without page overflow',layout['scrollWidth']<=width and layout['scrollHeight']<=height)
      if width==1024:
        report['layout_4_3']=layout;page.screenshot(path=str(preview/'4-by-3.png'))
    page.set_viewport_size({'width':390,'height':844});page.evaluate('collisionLab.go(3,2)');page.wait_for_timeout(150)
    check('mobile layout has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    page.screenshot(path=str(preview/'mobile.png'),full_page=True)
    offline=browser.new_page(viewport={'width':1024,'height':768});requests=[]
    offline.on('request',lambda r:requests.append(r.url));offline.on('pageerror',lambda e:report['errors'].append('standalone: '+str(e)))
    offline.set_content((ROOT/'binary-collision-lab.html').read_text());offline.wait_for_timeout(160)
    offline.evaluate('collisionLab.go(6,2)');offline.wait_for_timeout(150)
    check('standalone initializes without any network requests',len(requests)==0 and offline.evaluate('collisionLab.getDiagnostics().status==="ok"'))
    check('no JavaScript errors in tested scenes',not report['errors']);check('no failed asset requests',not report['network_failures'])
    report['standalone_note']='Classic inline script tested with page.set_content; native file navigation is restricted by the test browser policy.'
    browser.close()
finally:
  server.shutdown();report['passed']=sum(c['passed'] for c in report['checks']);report['total']=len(report['checks'])
  (ROOT/'tests'/'browser-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
  print(json.dumps(report,ensure_ascii=False,indent=2))
