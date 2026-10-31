/** Restricted editor markup. Never execute HTML, interpolate attributes or fetch embedded assets. */
const tags=new Set(['p','h2','h3','strong','b','em','i','u','s','strike','ul','ol','li','blockquote','pre','code','hr','br','a']);
function style(v:string){return v.split(';').filter(s=>s.trim()).every(s=>/^\s*text-align:\s*(left|center|right)\s*$/.test(s)||(/^\s*margin-left:\s*(\d+(?:\.\d+)?)rem\s*$/.test(s)&&Number(s.match(/([\d.]+)rem/)![1])<=20));}
function token(raw:string):boolean{
 if(!raw.startsWith('<'))return true;
 const m=raw.match(/^<(\/?)([a-z0-9]+)((?:\s+[^<>]*)?)\s*\/?>$/i);if(!m||!tags.has(m[2].toLowerCase()))return false;
 if(m[1])return !m[3].trim();
 const attrs=m[3].replace(/\s*\/$/,'');let offset=0;const used=new Set<string>();
 const re=/\s+([a-z-]+)="([^"]*)"/gy;
 while(offset<attrs.length){if(!attrs.slice(offset).trim())break;re.lastIndex=offset;const a=re.exec(attrs);if(!a||used.has(a[1]))return false;used.add(a[1]);offset=re.lastIndex;
  const [,name,value]=a,tag=m[2].toLowerCase();
  if(name==='style'&&['p','h2','h3'].includes(tag)&&style(value))continue;
  if(name==='start'&&tag==='ol'&&/^[1-9]\d{0,3}$/.test(value))continue;
  if(tag==='a'&&((name==='href'&&/^(https?:\/\/[^\s"<>]+|mailto:[a-z0-9@._+%-]+)$/i.test(value))||(name==='target'&&['_blank','_self'].includes(value))||(name==='rel'&&/^(?:noopener|noreferrer|nofollow)(?: (?:noopener|noreferrer|nofollow))*$/.test(value))))continue;
  return false;
 }
 return true;
}
const tokens=(html:string)=>html.match(/<[^<>]*>|[^<]+|</g)??[];
export const writingHtmlValid=(html:string)=>tokens(html).every(token);
/** Existing originals stay in the database; only safe editor markup is mounted. */
export const writingSafeHtml=(html:string)=>tokens(html).map(t=>token(t)?t:'').join('');
