/** Active chapters use their measured positions, including content that loads later. */
export function activeChapter(bounds, readingLine, atEnd=false) {
  if(atEnd) return bounds.at(-1)?.id || null;
  return bounds.reduce((current, chapter) => chapter.top <= readingLine ? chapter.id : current, bounds[0]?.id || null);
}
export function mountWorkspaceNavigation() {
  const header=document.querySelector('.topbar'), nav=document.querySelector('.section-nav');
  const chapters=[...document.querySelectorAll('[data-chapter]')];
  let scheduled=false;
  function update() {
    scheduled=false;
    const height=getComputedStyle(header).position==='sticky'?Math.ceil(header.getBoundingClientRect().height):0;
    document.documentElement.style.setProperty('--header-height',`${height}px`);
    const navHeight=getComputedStyle(nav).position==='fixed'?Math.ceil(nav.getBoundingClientRect().height):0;
    document.documentElement.style.setProperty('--bottom-nav-height',`${navHeight}px`);
    const atEnd=window.scrollY>0&&document.documentElement.scrollHeight-window.scrollY-window.innerHeight<=24;
    const current=activeChapter(chapters.map(node=>({id:node.dataset.chapter,top:node.getBoundingClientRect().top})),height+64,atEnd);
    for(const link of nav.querySelectorAll('a')) {
      if(link.getAttribute('href')===`#${current}`) link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    }
  }
  function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(update);}}
  function followAnchor(event) {
    const link=event.target.closest?.('a[href^="#"]');
    if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.defaultPrevented) return;
    let target;
    try { target=document.getElementById(decodeURIComponent(link.getAttribute('href').slice(1))); } catch { return; }
    if(!target) return;
    requestAnimationFrame(()=>{
      if(!target.hasAttribute('tabindex')) target.setAttribute('tabindex','-1');
      target.focus({preventScroll:true});
      schedule();
    });
  }
  const observer=new ResizeObserver(schedule);observer.observe(header);observer.observe(document.getElementById('briefing'));
  document.addEventListener('click',followAnchor);
  window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);update();
  return ()=>{observer.disconnect();document.removeEventListener('click',followAnchor);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);};
}
