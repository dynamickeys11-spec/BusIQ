import {useEffect,useMemo,useState,type ReactNode} from "react";
import {runIntelligencePipeline,type IntelligencePipelineResult} from "./intelligence";

type Experience="Workspace"|"Discover"|"Build"|"Library"|"Account";
type BusinessProfile={name:string;type:string;location:string};
type WorkItem={id:string;request:string;intent:IntelligencePipelineResult["intent"];createdAt:string;status:"active"|"complete"};
type LibraryItem={id:string;title:string;body:string;createdAt:string};
const experiences:Experience[]=["Workspace","Discover","Build","Library","Account"];
const profileKey="busiq:business-profile",workKey="busiq:work",libraryKey="busiq:library";
function load<T>(key:string,fallback:T):T{try{const v=localStorage.getItem(key);return v?JSON.parse(v)as T:fallback}catch{return fallback}}

export default function App(){
 const[active,setActive]=useState<Experience>("Workspace");
 const[profile,setProfile]=useState<BusinessProfile>(()=>load(profileKey,{name:"",type:"",location:""}));
 const[work,setWork]=useState<WorkItem[]>(()=>load(workKey,[]));
 const[library,setLibrary]=useState<LibraryItem[]>(()=>load(libraryKey,[]));
 const[request,setRequest]=useState("");
 const[pipeline,setPipeline]=useState<IntelligencePipelineResult|null>(null);
 const[online,setOnline]=useState(()=>navigator.onLine);
 const[savedMessage,setSavedMessage]=useState("");
 useEffect(()=>{localStorage.setItem(profileKey,JSON.stringify(profile))},[profile]);
 useEffect(()=>{localStorage.setItem(workKey,JSON.stringify(work))},[work]);
 useEffect(()=>{localStorage.setItem(libraryKey,JSON.stringify(library))},[library]);
 useEffect(()=>{const on=()=>setOnline(true),off=()=>setOnline(false);addEventListener("online",on);addEventListener("offline",off);return()=>{removeEventListener("online",on);removeEventListener("offline",off)}},[]);
 const activeWork=useMemo(()=>work.filter(x=>x.status==="active"),[work]);

 function submitRequest(value=request){
   const result=runIntelligencePipeline(value);
   if(!result.request)return;
   setPipeline(result);
   if(result.status!=="needs_clarification"){
     setWork(c=>[{id:crypto.randomUUID(),request:result.request,intent:result.intent,createdAt:new Date().toISOString(),status:"active" as const},...c].slice(0,20));
   }
   setRequest("");
   setActive("Workspace");
 }
 function saveNote(){
   const title=request.trim();if(!title)return;
   setLibrary(c=>[{id:crypto.randomUUID(),title,body:"Created from the BUSIQ workspace. This is user-owned local business knowledge.",createdAt:new Date().toISOString()},...c]);
   setRequest("");setSavedMessage("Saved to Library.");setTimeout(()=>setSavedMessage(""),2200);
 }

 return <main className="app-shell">
  <header className="topbar">
   <button className="wordmark" type="button" onClick={()=>setActive("Workspace")} aria-label="BUSIQ workspace">BUSIQ</button>
   <nav aria-label="Primary navigation">{experiences.map(ex=><button key={ex} type="button" className={active===ex?"nav-item active":"nav-item"} aria-current={active===ex?"page":undefined} onClick={()=>setActive(ex)}>{ex}</button>)}</nav>
   <span className={online?"connection-state":"connection-state offline"} aria-live="polite">{online?"Online":"Offline"}</span>
  </header>
  <section className="workspace">
   {active==="Workspace"&&<>
    <div className="workspace-heading"><div><div className="eyebrow">BUSIQ · WORKSPACE</div><h1>{profile.name?"Good morning. "+profile.name+".":"Business clarity, without the clutter."}</h1><p className="lede">{profile.name?"What would you like to understand or accomplish?":"Set up your business once, then use BUSIQ to understand, decide and act."}</p></div></div>
    <form className="ask-surface" onSubmit={e=>{e.preventDefault();submitRequest()}}>
      <label htmlFor="ask">Ask BUSIQ</label><textarea id="ask" value={request} onChange={e=>setRequest(e.target.value)} placeholder="What would you like to understand or accomplish?" rows={3}/>
      <div className="ask-actions"><span>BUSIQ resolves intent, ambiguity, capabilities and evidence before execution.</span><button className="primary-button" type="submit" disabled={!request.trim()}>Understand</button></div>
    </form>
    {pipeline&&<PipelineView result={pipeline}/>}
    <section className="attention-section"><div className="section-header"><div className="section-kicker">Current state</div><h2>{profile.name?"What matters now":"Start with the business"}</h2></div>
      {!profile.name?<article className="state-row"><div><strong>Your business is not connected yet.</strong><p>Enter your business details in Account. BUSIQ will store them locally on this device until a real backend is introduced.</p></div><button className="secondary-button" type="button" onClick={()=>setActive("Account")}>Set up business</button></article>
      :activeWork.length===0?<article className="state-row"><div><strong>No active work.</strong><p>Ask BUSIQ a real question or start a plan. New work appears here automatically.</p></div></article>
      :activeWork.slice(0,4).map(item=><article className="state-row" key={item.id}><div><strong>{item.request}</strong><p>{item.intent.label}</p></div><button className="secondary-button" type="button" onClick={()=>setWork(c=>c.map(x=>x.id===item.id?{...x,status:"complete"}:x))}>Mark complete</button></article>)}
    </section>
   </>}
   {active==="Discover"&&<Page title="Discover" eyebrow="BUSIQ · DISCOVER"><p>External intelligence belongs here when a question actually requires it.</p><div className="empty-state"><strong>No external source is connected.</strong><span>BUSIQ will not manufacture market, competitor, regulatory or industry facts. A research connector must be configured before those facts can appear.</span></div></Page>}
   {active==="Build"&&<Page title="Build" eyebrow="BUSIQ · BUILD"><p>Turn resolved business context into plans, decisions and usable outputs.</p><div className="build-grid"><button className="build-option" type="button" onClick={()=>{setRequest("Build a business plan");setActive("Workspace")}}><strong>Business plan</strong><span>Start from resolved business context rather than a blank document.</span></button><button className="build-option" type="button" onClick={()=>{setRequest("Create a 90-day growth plan");setActive("Workspace")}}><strong>90-day growth plan</strong><span>Convert an objective into structured work.</span></button></div></Page>}
   {active==="Library"&&<Page title="Library" eyebrow="BUSIQ · LIBRARY"><p>Your local business knowledge is stored on this device for now.</p><div className="library-toolbar"><input aria-label="New library item" value={request} onChange={e=>setRequest(e.target.value)} placeholder="Name a note or knowledge item"/><button className="primary-button" type="button" onClick={saveNote} disabled={!request.trim()}>Save</button></div>{savedMessage&&<div className="saved-message" role="status">{savedMessage}</div>}<div className="library-list">{library.length===0?<div className="empty-state"><strong>Library is empty.</strong><span>Saved knowledge will appear here.</span></div>:library.map(item=><article className="library-item" key={item.id}><strong>{item.title}</strong><p>{item.body}</p><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></article>)}</div></Page>}
   {active==="Account"&&<Page title="Account" eyebrow="BUSIQ · ACCOUNT"><p>Business identity is the only persistent context required at this stage.</p><form className="profile-form" onSubmit={e=>{e.preventDefault();setSavedMessage("Business profile saved.");setTimeout(()=>setSavedMessage(""),2200)}}><label>Business name<input value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})} required/></label><label>Business type<input value={profile.type} onChange={e=>setProfile({...profile,type:e.target.value})} placeholder="e.g. retail, services, manufacturing"/></label><label>Location<input value={profile.location} onChange={e=>setProfile({...profile,location:e.target.value})} placeholder="City / country"/></label><div className="form-actions"><button className="primary-button" type="submit">Save business</button>{savedMessage&&<span className="saved-message" role="status">{savedMessage}</span>}</div></form><div className="truth-note">No account service, cloud database, financial system, CRM, inventory system or external intelligence provider is connected yet. This is intentional: BUSIQ will only claim access to systems that are actually connected.</div></Page>}
  </section>
 </main>
}
function PipelineView({result}:{result:IntelligencePipelineResult}){
 return <section className="pipeline-card" aria-live="polite">
   <div className="section-kicker">Intelligence pipeline</div><h2>{result.answer.headline}</h2><p>{result.answer.detail}</p>
   <div className="pipeline-status"><strong>Status</strong><span>{result.status.replaceAll("_"," ")}</span></div>
   {result.ambiguity.length>0&&<div className="clarification"><strong>{result.ambiguity[0].question}</strong><span>{result.ambiguity[0].reason}</span></div>}
   <div className="pipeline-grid">
    <div><strong>Intent</strong><span>{result.intent.label}</span></div>
    <div><strong>Capabilities</strong><span>{result.capabilities.map(x=>x.reason).join(" · ")}</span></div>
    <div><strong>Research</strong><span>{result.researchPlan.filter(x=>x.status!=="not-required").map(x=>x.sourceClass).join(" · ")||"Not required"}</span></div>
    <div><strong>Evidence</strong><span>{result.evidence.some(x=>x.kind==="retrieved"||x.kind==="verified")?`${result.evidence.filter(x=>x.kind==="retrieved"||x.kind==="verified").length} retrieved/verified evidence item(s).`:"User input only; no retrieved source is being treated as fact."}</span></div>
    <div><strong>Execution</strong><span>{result.execution.length ? result.execution.map(x=>`${x.toolId}: ${x.state}`).join(" · ") : "No execution attempted."}</span></div>
   </div>
   {result.verification.missingEvidence.length>0&&<div className="truth-note"><strong>Evidence required</strong><p>{result.verification.missingEvidence.join(" ")}</p></div>}
   <div className="pipeline-trace"><strong>Trace</strong><span>{result.trace.join(" → ")}</span></div>
   <p className="next-action"><strong>Next:</strong> {result.answer.nextAction}</p>
 </section>
}
function Page({title,eyebrow,children}:{title:string;eyebrow:string;children:ReactNode}){return <div className="page"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{children}</div>}