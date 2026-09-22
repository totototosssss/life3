/* Admission forecasts are a game model. Published border facts keep their provenance. */
(function(root){
'use strict';
const D=root.LifeData,U=root.UNIVERSITIES,raw=root.ADMISSION_DATA,R=root.LifeAdmissionRules;
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v)),copy=v=>JSON.parse(JSON.stringify(v));
const norm=t=>String(t||'').normalize('NFKC').replace(/学部|学院|学群|学域|学科|課程|専攻|コース|[\s・－ー（）()\-]/g,'').replace(/学$/,'');
const byUni=new Map();
raw.rows.forEach((v,i)=>{const r={id:'r'+i,university:v[0],faculty:v[1],department:v[2],round:v[3],deviation:v[4],commonBorder:v[5],pattern:v[6],subjectCount:v[7],source:v[8],page:v[9],bf:v[10]};if(!byUni.has(r.university))byUni.set(r.university,[]);byUni.get(r.university).push(r);});
const legacyTokyo=copy(U.find(u=>u.name==='東京大学').courses);
U.find(u=>u.name==='東京大学').courses=['文科一類','文科二類','文科三類','理科一類','理科二類','理科三類'].map((faculty,i)=>({faculty,department:'教養学部から進学選択',field:['law','business','humanities','tech','science','medicine'][i],years:i===5?6:4,night:false,entryGroup:true}));
const overseas=[
 ['mit','マサチューセッツ工科大学','米国',78,620,'https://mitadmissions.org/apply/firstyear/international/'],
 ['stanford','スタンフォード大学','米国',79,650,'https://admission.stanford.edu/apply//international/index.html'],
 ['caltech','カリフォルニア工科大学','米国',79,650,'https://www.admissions.caltech.edu/apply/first-year-applicants/international-applicants'],
 ['oxford','オックスフォード大学','英国',76,500,'https://www.ox.ac.uk/admissions/undergraduate'],
 ['cambridge','ケンブリッジ大学','英国',76,520,'https://www.undergraduate.study.cam.ac.uk/international-students'],
 ['toronto','トロント大学','カナダ',66,430,'https://future.utoronto.ca/apply/'],
 ['nus','シンガポール国立大学','シンガポール',72,360,'https://www.nus.edu.sg/oam/admissions/international-qualifications-for-foreigners/admission-requirements'],
 ['ucl','ユニバーシティ・カレッジ・ロンドン','英国',70,480,'https://www.ucl.ac.uk/prospective-students/undergraduate/']
];
for(const [id,name,pref,difficulty,cost,source] of overseas)U.push({id:'overseas_'+id,name,pref,type:'海外',foreign:true,difficulty,cost,source,courses:[{faculty:'Computer Science',department:'計算機科学',field:'tech',years:pref==='英国'?3:4,night:false},{faculty:'Mathematics',department:'数学',field:'science',years:pref==='英国'?3:4,night:false},...(id==='caltech'?[]:[{faculty:'Economics',department:'経済学',field:'business',years:pref==='英国'?3:4,night:false}])]});
function facultyMatch(a,b){a=norm(a);b=norm(b);return a===b||a.length>=4&&b.startsWith(a)||b.length>=4&&a.startsWith(b);}
const cache=new Map();
function routes(u,c){
 const key=u.id+'|'+c.faculty+'|'+c.department;if(cache.has(key))return cache.get(key);
 if(u.foreign)return[{id:'foreign',round:'海外',deviation:null,commonBorder:null,faculty:c.faculty,department:c.department,foreign:true,model:true,source:u.source}];
 let list=(byUni.get(u.id)||[]).filter(r=>facultyMatch(r.faculty,c.faculty));
 if(c.entryGroup)list=(byUni.get(u.id)||[]).filter(r=>r.faculty===c.faculty);
 const clean=t=>norm(String(t||'').normalize('NFKC').replace(/共テ.*|共通テスト.*|学部別.*|全学.*|[A-D]方式.*|一般.*|前期.*|後期.*|[123456]科目.*/,''));
 const dep=norm(c.department),scored=list.map(r=>{const d=clean(r.department);return {r,score:d===dep&&d?1000+d.length:d&&d.length>=Math.max(2,dep.length*.65)&&dep.includes(d)?d.length:0};});const best=Math.max(0,...scored.map(x=>x.score)),matches=scored.filter(x=>best&&x.score===best).map(x=>x.r);
 if(matches.length)list=matches;
 // Ambiguous faculty-level rows are labelled reference rows, never asserted to be an exact department match.
 list=list.map(r=>({...r,reference:!c.entryGroup&&!!clean(r.department)&&clean(r.department)!==dep}));
 if(!list.length){const f={medicine:67.5,dentistry:52.5,pharmacy:50,veterinary:60,nursing:47.5,healthcare:45,tech:47.5,science:50,law:50,business:47.5,humanities:47.5,education:47.5,arts:45,sports:42.5,social:45}[c.field]||45;
  list=[{id:'model',faculty:c.faculty,department:c.department,round:u.type==='私立'?'私立一般':'前期',deviation:f+(u.type==='国立'?5:u.type==='公立'?2.5:0),commonBorder:u.type==='私立'?null:55+(f-45),model:true,pattern:'科目モデル',subjectCount:'モデル'}];
 }
 cache.set(key,list);return list;
}
function route(u,c,id){return routes(u,c).find(r=>r.id===id)||routes(u,c)[0];}
function chosenSelection(s,u,c,id,selection){return selection||s.plan.applications?.find(ap=>ap.university===u.id&&u.courses[ap.course]===c&&ap.route===id)?.selection;}
function subjectSet(s,u,c,r,selection){
 const p=R.resolve(s,u,c,r,chosenSelection(s,u,c,r.id,selection)),weights=R.weights(p.individual),commonWeights=R.weights(p.common);
 return {...p,individualGroups:p.individual,commonGroups:p.common,individual:Object.keys(weights),common:Object.keys(commonWeights),weights,commonWeights,label:p.note,pattern:r.pattern||'個別試験',source:p.source};
}
function ability(s,k){if(k==='essay')return s.admissions.essaySkill??Math.min(200,s.skills.language*.55);return s.subjects[k]||0;}
function subjectPercent(s,k){let v=ability(s,k);if(k==='mathIII')v=Math.min(v,(s.subjects.mathII||0)*1.25);return clamp(v*.70,0,99);}
function commonScores(s,profile=s.plan.commonTrack||'science'){const values=Object.fromEntries(Object.keys(D.SUBJECTS).map(k=>[k,Math.round(subjectPercent(s,k)*10)/10]));const science=(s.plan.sciencePair||'physics,chemistry').split(',');values.scienceBasic=Math.round((values[science[0]]+values[science[1]])/2);const social=s.plan.socialSubject||'history',second=s.plan.socialSecond||'geography';const total=values.japanese*2+values.mathI+values.mathII+values.englishR+values.englishL+values.information+(profile==='humanities'?values.scienceBasic+(values[social]||0)+(values[second]||0):(values[science[0]]||0)+(values[science[1]]||0)+(values[social]||0));return {values,total:Math.round(total),max:1000,profile};}
function average(s,weights,percent=false){const total=Object.values(weights).reduce((a,b)=>a+b,0);return total?Object.entries(weights).reduce((v,[k,w])=>v+(percent?subjectPercent(s,k):ability(s,k))*w,0)/total:null;}
function estimate(s,u,c,id,forecast=true,selection){
 const n=forecast?root.LifeEngine.projected(s):s,r=route(u,c,id),sets=subjectSet(n,u,c,r,chosenSelection(s,u,c,r.id,selection));
 const written=sets.externalEnglish?{...sets.weights}:sets.weights;
 if(sets.externalEnglish)for(const[k,w]of Object.entries(sets.commonWeights))written[k]=(written[k]||0)+w;
 const mean=average(n,written),deviation=mean===null?null:25+mean*.35-Math.max(0,n.stats.stress-45)*.035,ct=sets.usesCommon?average(n,sets.commonWeights,true):null;
 let p=0;
 if(u.foreign){const eng=Math.min(subjectPercent(n,'englishR'),subjectPercent(n,'englishL')),portfolio=Math.min(8,(n.competition?.rating||0)/800+(n.music?.skill||0)/60+(n.impact||0)/250);p=1/(1+Math.exp(-(deviation+portfolio-u.difficulty)/2.8));if(eng<72)p*=Math.pow(eng/72,6);}
 else{const zi=sets.commonOnly||r.deviation===null?null:(deviation-r.deviation)/2.4,zc=r.commonBorder===null||ct===null?null:(ct-r.commonBorder)/3;
  const z=zi===null?(zc??((deviation??0)-35)/4):zc===null?zi:zi*sets.individualShare+zc*(1-sets.individualShare);
  p=1/(1+Math.exp(-z));if(zc!==null)p=Math.min(p,1/(1+Math.exp(-zc*.8)));
  if(r.bf)p=Math.min(.99,.50+((deviation??25)-30)*.025);
 }
 // III is never an implicit requirement of a common-only or non-mathematics route.
 if(sets.math3&&(n.subjects.mathIII||0)<30)p*=Math.pow((n.subjects.mathIII||0)/30,2);
 if(sets.englishMinimum&&ability(n,'englishR')<80)p*=Math.pow(ability(n,'englishR')/80,3);
 if(sets.secondStage)p*=.55+.45*clamp((ability(n,'essay')*.6+(n.inner.interview||0)*1.2)/110,0,1);
 p=clamp(p,0,.995);if(p<.0001)p=0;
 const used=[...new Set([...sets.individual,...(sets.usesCommon?sets.common:[]),...(sets.secondStage?['essay']:[])])];
 const breakdown=(groups,stage)=>groups.map(g=>({name:g.name,points:g.points,stage,level:Math.round(average(n,g.parts,stage==='common')*10)/10,parts:g.parts}));
 return {probability:p,rank:p>=.8?'A':p>=.65?'B':p>=.5?'C':p>=.2?'D':'E',deviation:deviation===null?null:Math.round(deviation*10)/10,common:ct===null?null:Math.round(ct*10)/10,route:r,subjects:sets,used,unused:Object.keys(D.SUBJECTS).filter(k=>!used.includes(k)),breakdown:[...breakdown(sets.individualGroups,'individual'),...breakdown(sets.usesCommon?sets.commonGroups:[],'common')]};
}
function applicationCost(u,r){return u.foreign?2.5:u.type==='私立'?(r&&r.deviation===null&&r.commonBorder!==null?1.8:3.5):1.7;}
function publicRound(u,r){return !u.foreign&&u.type!=='私立'&&['前期','中期','後期'].includes(r.round)?r.round:null;}
function selectionValid(s,u,c,r,selection){return !selection||R.validContext(selection.context)&&R.variants(s,u,c,r,selection.context).some(v=>v.id===selection.option);}
function applicationError(s,ap,ignore=-1){const E=root.LifeEngine,u=E.universityById(ap.university),c=u?.courses[ap.course];if(!u||!c)return'学部・学科を選んでください';const reason=E.universityEligibility(s,u,c,ap.mode);if(reason)return reason;const r=routes(u,c).find(r=>r.id===ap.route)||(!ap.route?route(u,c):null);if(!r)return'この学科の入試方式を選んでください';if(!selectionValid(s,u,c,r,ap.selection))return'受験科目の選択を確認してください';const list=s.plan.applications.filter((_,i)=>i!==ignore);
 if(list.some(v=>v.university===u.id&&v.course===ap.course&&v.route===r.id))return'同じ方式は登録済みです';
 if(list.length>=7)return'1年の出願は7方式までです';
 const pr=publicRound(u,r);if(pr&&list.some(v=>{const uu=E.universityById(v.university);return publicRound(uu,route(uu,uu.courses[v.course],v.route))===pr;}))return`国公立の${pr}は1校までです。私立との併願は可能です`;
 if(u.type==='私立'&&list.filter(v=>E.universityById(v.university).type==='私立').length>=3)return'私立は3方式までです。国公立の枠とは別です';
 if(u.foreign&&list.filter(v=>E.universityById(v.university).foreign).length>=2)return'海外は2方式までです';
 if(s.plan.admission&&s.plan.admission.kind!=='college')return'大学院等への進学予定を外してから選んでください';return'';
}
function add(s,ap,updateIndex=-1){if(s.finished)return'この人生は完結しています';if(updateIndex!==-1&&(!Number.isInteger(updateIndex)||!s.plan.applications[updateIndex]))return'更新する出願が見つかりません';const error=applicationError(s,ap,updateIndex);if(error)return error;const u=root.LifeEngine.universityById(ap.university),c=u.courses[ap.course],r=route(u,c,ap.route),selection=R.resolve(s,u,c,r,ap.selection).selection,record={university:u.id,course:ap.course,route:r.id,mode:ap.mode||'full',selection};if(updateIndex>=0)s.plan.applications[updateIndex]=record;else s.plan.applications.push(record);s.plan.school=null;s.plan.admission=null;return'';}
function relocation(s,u,mode){return mode==='night'?0:u.foreign?100:(u.pref!==root.LifeEngine.systems.pref(s.prefecture).name&&u.pref!==root.LifeEngine.systems.pref(s.prefecture).name.slice(0,-1)?25:0);}
function quote(s){const E=root.LifeEngine,rows=s.plan.applications.map(ap=>{const u=E.universityById(ap.university),c=u.courses[ap.course],r=route(u,c,ap.route),fee=E.tuition(u,c,ap.mode);return{ap,u,c,r,fee,move:relocation(s,u,ap.mode),cost:applicationCost(u,r)};}),exam=rows.reduce((n,v)=>n+v.cost,0),entry=Math.max(0,...rows.map(v=>v.fee.entry+v.move)),hold=s.plan.reservePrivate&&rows.some(v=>publicRound(v.u,v.r))?Math.max(0,...rows.filter(v=>v.u.type==='私立').map(v=>v.fee.entry)):0;
 return{rows,exam,entry,hold,total:exam+entry+hold,available:Math.max(0,s.cash)+(s.age<18?s.parents.educationFund:0),annualTuition:rows[0]?.fee.annual||0};}
function studyPlan(s){const priority={};let essay=false;for(const[order,ap]of s.plan.applications.entries()){const u=root.LifeEngine.universityById(ap.university),c=u.courses[ap.course],est=estimate(s,u,c,ap.route,false,ap.selection);for(const[k,w]of Object.entries({...est.subjects.weights,...Object.fromEntries(Object.entries(est.subjects.commonWeights).map(([k,w])=>[k,w+(est.subjects.weights[k]||0)]))})){if(k==='essay'){essay=true;continue;}priority[k]=(priority[k]||0)+w/(order+1);}if(est.subjects.secondStage)essay=true;}
 const keys=Object.keys(D.SUBJECTS),sum=Object.values(priority).reduce((a,b)=>a+b,0);if(!sum)return null;const exact=keys.map(k=>(priority[k]||0)*12/sum),weights=exact.map(Math.floor),left=12-weights.reduce((a,b)=>a+b,0);exact.map((v,i)=>({i,f:v-weights[i]})).sort((a,b)=>b.f-a.f).slice(0,left).forEach(v=>weights[v.i]++);return{weights,essay,used:keys.filter(k=>priority[k]),mathTrack:priority.mathIII?'mathIII':priority.mathII?'mathII':priority.mathI?'mathI':s.plan.mathTrack};}
function settle(s,report,rand){const E=root.LifeEngine,list=s.plan.applications;if(!list.length)return;s.admissions.results=[];s.admissions.expenses={exams:0,reservation:0,enrollment:0,relocation:0};const charge=(amount,key)=>{if(!root.LifeNext.payEducation(s,amount))return false;s.admissions.expenses[key]+=amount;s.totals.spending+=amount;s.yearStats.spending+=amount;return true;};
 const approved=[];for(const ap of list){const u=E.universityById(ap.university),c=u?.courses[ap.course],r=c?route(u,c,ap.route):null,why=u&&c?E.universityEligibility(s,u,c,ap.mode,false):'出願先が見つかりません';if(why){report.push({kind:'fail',text:`${u?.name||'出願'}：${why}`});continue;}if(!charge(applicationCost(u,r),'exams')){report.push({kind:'fail',text:`${u.name}：検定料不足で出願を見送った。優先順位の高い出願から支払います。`});s.admissions.results.push({name:u.name,round:r.round,passed:false,unfunded:true});continue;}approved.push({ap,u,c,r,prepaid:0});}
 if(!approved.length)return;const commonDraw=rand(s),wins=[];let publicAccepted=false,privateHandled=false;
 const order=v=>({前期:1,中期:2,後期:3}[publicRound(v.u,v.r)]||0),position=v=>list.indexOf(v.ap),ordered=[...approved].sort((a,b)=>order(a)-order(b));
 const handlePrivate=()=>{if(privateHandled)return;privateHandled=true;const priv=wins.filter(v=>v.u.type==='私立').sort((a,b)=>position(a)-position(b));if(!priv.length)return;const best=priv[0],wait=approved.some(v=>order(v)&&position(v)<position(best));if(!wait)return;
  for(const v of priv)v.record.expired=true;
  const deposit=E.tuition(best.u,best.c,best.ap.mode).entry;if(s.plan.reservePrivate&&charge(deposit,'reservation')){best.prepaid=deposit;best.record.reserved=true;best.record.expired=false;report.push({kind:'life',text:`${best.u.name}の入学金${deposit}万円を納め、国公立の結果を待つ。別の大学へ進んでも、この入学金は戻らない。`});}else report.push({kind:'life',text:`${best.u.name}の入学金を${s.plan.reservePrivate?'用意できず':'納めず'}、国公立の結果を待った。私立の手続期限を過ぎ、席は確保できなかった。`});
 };
 for(const v of ordered){if(order(v))handlePrivate();const {u,c,ap}=v,est=estimate(s,u,c,ap.route,false,ap.selection);if(publicAccepted&&['中期','後期'].includes(publicRound(u,v.r))){s.admissions.results.push({university:u.id,course:ap.course,route:ap.route,name:u.name+' '+c.faculty,round:v.r.round,passed:false,skipped:true,probability:est.probability});report.push({kind:'life',text:u.name+'［'+v.r.round+'］：国公立の前の日程で手続済みのため合格対象外。'});continue;}
  const independent=rand(s),draw=est.subjects.commonOnly?commonDraw:independent,pass=draw<est.probability;s.admissionAttempts[u.id]=(s.admissionAttempts[u.id]||0)+1;const record={university:u.id,course:ap.course,route:ap.route,name:u.name+' '+c.faculty,round:v.r.round,passed:pass,probability:est.probability,selection:ap.selection};v.record=record;s.admissions.results.push(record);report.push({kind:pass?'success':'fail',text:`${u.name} ${c.faculty}［${v.r.round}］：${pass?'合格':'不合格'}（直前見込み${formatProbability(est.probability)}）。`});
  if(pass){const laterPreferred=approved.some(w=>order(w)>order(v)&&position(w)<position(v)),betterOffer=wins.some(w=>!w.record.expired&&position(w)<position(v)&&Math.max(0,s.cash)+(s.age<18?s.parents.educationFund:0)>=E.tuition(w.u,w.c,w.ap.mode).entry-w.prepaid+relocation(s,w.u,w.ap.mode));if(order(v)&&laterPreferred&&!betterOffer){record.declined=true;report.push({kind:'life',text:u.name+'の手続きは辞退。上位に置いた後の日程へ進む。'});}else{wins.push(v);const funds=Math.max(0,s.cash)+(s.age<18?s.parents.educationFund:0);if(order(v)&&!betterOffer&&funds>=E.tuition(u,c,ap.mode).entry+relocation(s,u,ap.mode))publicAccepted=true;}}
 }
 s.admissions.common={age:s.age,...commonScores(s)};
 const offers=wins.filter(v=>!v.record.expired).sort((a,b)=>position(a)-position(b));let selected=null;
 for(const v of offers){const fee=E.tuition(v.u,v.c,v.ap.mode),move=relocation(s,v.u,v.ap.mode),remaining=fee.entry-v.prepaid;if(!root.LifeNext.payEducation(s,remaining+move)){v.record.unfunded=true;report.push({kind:'fail',text:`${v.u.name}の手続き・転居費${(remaining+move).toFixed(1)}万円が不足。次の合格先を確認した。`});continue;}s.admissions.expenses.enrollment+=remaining;s.admissions.expenses.relocation+=move;s.totals.spending+=remaining+move;s.yearStats.spending+=remaining+move;selected=v;break;}
 if(!selected){s.school.ronin=true;s.stats.stress+=5;return;}
 const {u,c,ap}=selected,fees=E.tuition(u,c,ap.mode);selected.record.enrolled=true;s.education={kind:'college',name:u.name+' '+c.faculty,university:u.id,department:c.department,field:c.field,total:c.years,progress:0,tuition:fees.annual,mode:ap.mode,paused:false,foreign:!!u.foreign};s.school.ronin=false;if(ap.mode==='full'&&s.job!=='parttime')s.job=null;s.retired=false;
 if(u.foreign){s.visits++;s.stats.connections+=3;}else if(ap.mode==='full'){const destination=D.PREFECTURES.find(p=>p.name===u.pref||p.name.slice(0,-1)===u.pref);if(destination){s.prefecture=destination.id;s.region=destination.metro?'metro':'local';}}
 s.history.unshift({age:s.age,title:'入学先を決定',text:`${u.name} ${c.faculty}。${selected.prepaid?'確保していた席の入学金は二重に払わず、':''}優先順位と手続き費用を確認して入学した。`,kind:'education'});report.push({kind:'success',text:`第${list.indexOf(ap)+1}志望の合格先、${u.name}に入学。`});
}
function formatProbability(p){return p===0?'0%':p<.001?'0.1%未満':(p*100).toFixed(p<.1?1:0)+'%';}
function sourceURL(r){return r.model?null:'https://www.keinet.ne.jp/exam/ranking/2027/'+r.source+'.pdf#page='+r.page;}
function mock(s){if(s.finished||s.age<15)return'共通テスト型の模試は高校段階から受けられます';const year=s.admissions.mocks.filter(v=>v.age===s.age);if(year.length>=3)return'今年の模試は3回受験済みです';if(s.plan.allocation.study<1)return'学ぶ時間を1コマ以上にしてください';if(!root.LifeNext.payEducation(s,.6))return'受験料6,000円が必要です';
 const base=commonScores(s),i=year.length;let h=2166136261;for(const c of s.seed+s.age+'mock'+i){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}const offset=((h>>>0)%61-30)/10;
 const values=Object.fromEntries(Object.entries(base.values).map(([k,v])=>[k,Math.round(clamp(v+offset)*10)/10]));const targets=s.plan.applications.map(ap=>{const u=root.LifeEngine.universityById(ap.university),c=u.courses[ap.course],v=estimate(s,u,c,ap.route,false);return{name:u.name+' '+c.faculty,p:v.probability,rank:v.rank};});
 s.admissions.mocks.push({age:s.age,period:s.period,number:i+1,values,total:Math.round(clamp(base.total+offset*10,0,1000)),targets});s.admissions.mocks=s.admissions.mocks.slice(-60);s.inner.academicConfidence=clamp(s.inner.academicConfidence+1);return'';
}
root.LifeAdmissions={routes,route,subjectSet,estimate,commonScores,subjectPercent,add,settle,mock,applicationCost,applicationError,selectionValid,quote,studyPlan,relocation,publicRound,sourceURL,formatProbability,legacyTokyo,coverage:{rows:raw.rows.length,universities:byUni.size},overseas};
})(typeof window!=='undefined'?window:globalThis);
