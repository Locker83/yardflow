import React from 'react';

export const T = {
  bg:"#0B0E11",sf:"#141820",sa:"#1A1F2B",bd:"#252B38",tx:"#E8ECF1",tm:"#7A8499",td:"#4A5568",
  ac:"#FF6B2C",ag:"rgba(255,107,44,0.15)",ok:"#22C55E",wn:"#FBBF24",dg:"#EF4444",in:"#60A5FA",pp:"#A78BFA"
};

export const ROLE_COLORS = { admin:"#EF4444", manager:"#FF6B2C", warehouse:"#60A5FA", hostler:"#22C55E" };

export const MOVE_TYPES = [
  {id:"dock",label:"Spot to Dock",icon:"🏗️"},{id:"pull",label:"Pull from Dock",icon:"🔄"},
  {id:"adjust",label:"Adjust Dock Plate",icon:"⚙️"},{id:"yard-move",label:"Yard Relocation",icon:"📦"},
  {id:"gate-in",label:"Gate Check-In",icon:"🚪"},{id:"gate-out",label:"Gate Departure",icon:"🚛"}
];
export const TRAILER_TYPES = ["Dry Van","Reefer","Flatbed","Tanker"];
export const TRAILER_STATUSES = ["Empty","Loaded","Partial","Sealed","Live Load"];
export const ROLES = [
  {id:"admin",label:"Admin",desc:"Full access + user management"},
  {id:"manager",label:"Manager",desc:"Dashboard, analytics, all views"},
  {id:"warehouse",label:"Warehouse",desc:"Request moves, view trailers & yard"},
  {id:"hostler",label:"Hostler",desc:"Claim & complete moves"}
];

export const mtl = id => MOVE_TYPES.find(m=>m.id===id)?.label ?? id;
export const mti = id => MOVE_TYPES.find(m=>m.id===id)?.icon ?? "📦";
export const sc = s => ({pending:T.wn,"in-progress":T.in,completed:T.ok}[s]??T.tm);

export const Badge = ({color,children,small}) => <span style={{display:"inline-flex",alignItems:"center",padding:small?"1px 6px":"2px 10px",borderRadius:4,fontSize:small?10:11,fontWeight:700,letterSpacing:"0.04em",textTransform:"uppercase",background:color+"22",color,border:`1px solid ${color}44`,whiteSpace:"nowrap"}}>{children}</span>;

export const Dot = ({color}) => <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:color,boxShadow:`0 0 6px ${color}88`,marginRight:6,flexShrink:0}}/>;

export const Card = ({children,style,onClick}) => <div onClick={onClick} style={{background:T.sf,border:`1px solid ${T.bd}`,borderRadius:10,padding:20,cursor:onClick?"pointer":"default",transition:"border-color 0.2s",...style}} onMouseEnter={e=>{if(onClick){e.currentTarget.style.borderColor=T.ac;e.currentTarget.style.boxShadow=`0 0 20px ${T.ag}`}}} onMouseLeave={e=>{if(onClick){e.currentTarget.style.borderColor=T.bd;e.currentTarget.style.boxShadow="none"}}}>{children}</div>;

export const Btn = ({children,variant="primary",onClick,disabled,style:s,small}) => {
  const v={primary:{bg:T.ac,c:"#fff",b:"none"},secondary:{bg:"transparent",c:T.tx,b:`1px solid ${T.bd}`},success:{bg:T.ok,c:"#fff",b:"none"},danger:{bg:T.dg,c:"#fff",b:"none"},ghost:{bg:"transparent",c:T.tm,b:"none"}}[variant];
  return <button onClick={onClick} disabled={disabled} style={{display:"inline-flex",alignItems:"center",gap:6,padding:small?"6px 12px":"10px 20px",borderRadius:6,fontSize:small?12:13,fontWeight:600,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,background:v.bg,color:v.c,border:v.b,transition:"all 0.15s",fontFamily:"inherit",...s}}>{children}</button>;
};

export const Input = ({label,value,onChange,placeholder,options,type="text",style:s,...rest}) => (
  <div style={{display:"flex",flexDirection:"column",gap:4,...s}}>
    {label && <label style={{fontSize:11,fontWeight:600,color:T.tm,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</label>}
    {options ? <select value={value} onChange={e=>onChange(e.target.value)} style={{padding:"9px 12px",borderRadius:6,background:T.sa,border:`1px solid ${T.bd}`,color:T.tx,fontSize:13,fontFamily:"inherit",outline:"none"}} {...rest}><option value="">— Select —</option>{options.map(o=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}</select>
    : <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{padding:"9px 12px",borderRadius:6,background:T.sa,border:`1px solid ${T.bd}`,color:T.tx,fontSize:13,fontFamily:"inherit",outline:"none"}} {...rest}/>}
  </div>
);

export const Modal = ({open,onClose,title,children,width=520}) => { if(!open) return null; return (
  <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)"}} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{background:T.sf,border:`1px solid ${T.bd}`,borderRadius:14,width,maxWidth:"95vw",maxHeight:"90vh",overflow:"auto",padding:28,boxShadow:"0 24px 80px rgba(0,0,0,0.5)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h3 style={{margin:0,fontSize:18,fontWeight:700,color:T.tx}}>{title}</h3>
        <button onClick={onClose} style={{background:"none",border:"none",color:T.tm,fontSize:20,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
      </div>{children}
    </div>
  </div>);
};

export const Tbl = ({columns,data,onRow}) => (
  <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
    <thead><tr>{columns.map(c=><th key={c.key} style={{textAlign:"left",padding:"10px 12px",borderBottom:`1px solid ${T.bd}`,color:T.tm,fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:"0.06em",whiteSpace:"nowrap"}}>{c.label}</th>)}</tr></thead>
    <tbody>{data.length===0&&<tr><td colSpan={columns.length} style={{padding:30,textAlign:"center",color:T.td}}>No data</td></tr>}
      {data.map((row,i)=><tr key={row.id??i} onClick={()=>onRow?.(row)} style={{cursor:onRow?"pointer":"default",borderBottom:`1px solid ${T.bd}11`}} onMouseEnter={e=>e.currentTarget.style.background=T.sa} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
        {columns.map(c=><td key={c.key} style={{padding:"10px 12px",color:T.tx,whiteSpace:"nowrap"}}>{c.render?c.render(row):row[c.key]}</td>)}
      </tr>)}
    </tbody>
  </table></div>
);

export const TTag = ({number,type}) => <span style={{display:"inline-flex",alignItems:"center",gap:6}}><span style={{fontWeight:800,color:T.ac,fontFamily:"'JetBrains Mono',monospace"}}>{number}</span>{type&&<Badge color={type==="Reefer"?T.in:type==="Flatbed"?T.wn:type==="Tanker"?T.pp:T.tm} small>{type}</Badge>}</span>;

export const Avatar = ({name,color,size=32}) => <div style={{width:size,height:size,borderRadius:"50%",background:color||T.ac,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:size*0.4,fontWeight:800,color:"#fff",flexShrink:0}}>{(name||"?")[0].toUpperCase()}</div>;

export const Spinner = () => <div style={{display:"flex",justifyContent:"center",padding:40}}><div style={{width:32,height:32,border:`3px solid ${T.bd}`,borderTopColor:T.ac,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;
