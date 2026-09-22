/* Subject groups are separate from the published border table. Sources and model
   status travel with each profile; a published border does not verify its subjects. */
(function(root){
'use strict';
const sources={
 keio:'https://www.keio.ac.jp/files/d76245e2bdc5e5a3f397c40b2ae40047b4d41cd3ea399c3b4dbf969c3ad989a7',
 meiji:'https://www.meiji.ac.jp/koho/guidebook/univ/guide2027_11admission.pdf',
 chuo:'https://www.chuo-u.ac.jp/common_d/connect/admission/2027/overview/ippan_guidelines.pdf',
 rikkyo:'https://www.rikkyo.ac.jp/admissions/undergraduate/',
 waseda:'https://www.waseda.jp/fpse/pse/assets/uploads/2025/02/900a838a51c30f1230c5d42bbf2e7270.pdf'
};
const label={japanese:'国語',englishR:'英語',history:'歴史',geography:'地理',civics:'公民',physics:'物理',chemistry:'化学',biology:'生物',information:'情報',mathI:'数学Ⅰ・A',mathII:'数学Ⅱ・B・C',essay:'小論文'};
const g=(key,points=100)=>({name:label[key]||key,points,parts:{[key]:1}});
const math=(advanced=false,points=100)=>({name:advanced?'数学Ⅰ〜Ⅲ':'数学Ⅰ・Ⅱ',points,parts:advanced?{mathI:.25,mathII:.35,mathIII:.4}:{mathI:.45,mathII:.55}});
const english=(points=200,reading=.5)=>({name:'英語（R・L）',points,parts:{englishR:reading,englishL:1-reading}});
const choose=(id,name,individual,common=[],extra={})=>({id,name,individual,common,...extra});
const compact=s=>String(s||'').normalize('NFKC');
const mathKeys=['mathI','mathII','mathIII'];
const scienceFields=['science','tech','medicine','dentistry','pharmacy','veterinary','nursing','healthcare'];
function context(s,value){return value||{sciencePair:s.plan.sciencePair||'physics,chemistry',socialSubject:s.plan.socialSubject||'history',socialSecond:s.plan.socialSecond||'geography',commonTrack:s.plan.commonTrack||'science'};}
function validContext(v){return !!v&&['physics,chemistry','chemistry,biology','physics,biology'].includes(v.sciencePair)&&['history','geography','civics'].includes(v.socialSubject)&&['history','geography','civics'].includes(v.socialSecond)&&v.socialSubject!==v.socialSecond&&['science','humanities'].includes(v.commonTrack);}
function isScience(c){if(/^(文学部|人文学部|人文科学部|経済学部|経営学部|商学部|法学部|社会学部|政治経済学部|総合政策学部)$/.test(c.faculty))return false;return scienceFields.includes(c.field);}
function variants(s,u,c,r,ctx){
 const sel=context(s,ctx),sci=sel.sciencePair.split(','),social=sel.socialSubject,second=sel.socialSecond;
 const science=r.pattern==='文型'?false:r.pattern==='理型'?true:isScience(c),advanced=['science','tech','medicine','dentistry','pharmacy','veterinary'].includes(c.field);
 const hasCommon=r.commonBorder!==null&&r.commonBorder!==undefined,commonOnly=hasCommon&&r.deviation===null;
 const standardCommon=[g('japanese',200),g('mathI'),g('mathII'),english(),g('information'),...(science?sci.map(k=>g(k)):[{name:'理科基礎',points:100,parts:Object.fromEntries(sci.map(k=>[k,.5]))}]),g(social),...(science?[]:[g(second)])];
 const dep=compact(r.department),faculty=c.faculty;
 let source=null,status='model',note='科目と配点は代表的なゲーム設定です。公表ボーダーとは確認範囲が異なります。',choices=[];
 const official=(key,explanation)=>{source=sources[key];status='official';note=explanation+' 日本史・世界史や外国語の種類は集約し、外国語は英語で受験します。';};
 if(u.name==='慶應義塾大学'&&!hasCommon){
  official('keio','2027年度の科目と配点を参照。数学の範囲内の配分、小論文・面接の採点はゲーム設定です。');
  if(faculty==='経済学部')choices=[choose('standard',dep.includes('A方式')?'英語＋数学':'英語＋歴史',dep.includes('A方式')?[g('englishR',200),math(false,200)]:[g('englishR',200),g('history',200)])];
  else if(faculty==='文学部')choices=[choose('standard','英語＋歴史＋小論文',[g('englishR',150),g('history'),g('essay')])];
  else if(faculty==='法学部')choices=[choose('standard','英語＋歴史＋小論文',[g('englishR',200),g('history',150),g('essay')])];
  else if(faculty==='商学部')choices=['history','geography'].map(k=>choose(k,'英語＋'+label[k]+'＋'+(dep.includes('A方式')?'数学':'論文テスト'),[g('englishR',200),g(k),dep.includes('A方式')?math():g('essay')]));
  else if(faculty==='総合政策学部'||faculty==='環境情報学部')choices=[
   choose('english','英語＋小論文',[g('englishR',200),g('essay',200)]),
   choose('math','数学＋小論文',[math(faculty==='環境情報学部',200),g('essay',200)]),
   choose('english_math','英語・数学＋小論文',[g('englishR'),math(),g('essay',200)]),
   choose('information_math','情報・数学＋小論文',[g('information'),math(),g('essay',200)])
  ];
  else if(faculty==='理工学部')choices=[choose('standard','英語＋数学Ⅲ＋物理＋化学',[g('englishR',150),math(true,150),g('physics'),g('chemistry')])];
  else if(faculty==='薬学部')choices=[choose('standard','英語＋数学Ⅲ＋化学',[g('englishR'),math(true),g('chemistry',150)])];
  else if(faculty==='医学部')choices=['physics,chemistry','chemistry,biology','physics,biology'].map(pair=>choose(pair,'英語＋数学Ⅲ＋'+pair.split(',').map(k=>label[k]).join('・'),[g('englishR',150),math(true,150),...pair.split(',').map(k=>g(k))],[],{secondStage:true}));
  else if(faculty==='看護医療学部')choices=['math','chemistry','biology'].map(k=>choose(k,'英語＋'+(k==='math'?'数学Ⅰ・Ⅱ':label[k]),[g('englishR',300),k==='math'?math(false,200):g(k,200)],[],{secondStage:true}));
 }
 if(u.name==='明治大学'){
  // General faculty exams have different requirements from the common-only routes.
  if(dep.includes('学部別')&&!hasCommon&&!/英/.test(dep)){
   if(faculty==='総合数理学部')choices=[choose('standard','数学Ⅲ＋英語',[math(true,200),g('englishR',120)])];
   if(faculty==='理工学部')choices=['physics','chemistry'].map(k=>choose(k,'英語＋数学Ⅲ＋'+label[k],[g('englishR',120),math(true,120),g(k,120)]));
   if(faculty==='法学部')choices=['history','civics'].map(k=>choose(k,'英語＋国語＋'+label[k],[g('englishR',150),g('japanese'),g(k)]));
   if(['商学部','政治経済学部','情報コミュニケーション学部'].includes(faculty))choices=['history','geography','civics','math'].filter(k=>faculty!=='情報コミュニケーション学部'||k!=='geography').map(k=>choose(k,'英語＋国語＋'+(k==='math'?'数学Ⅰ・Ⅱ':label[k]),[g('englishR',faculty==='情報コミュニケーション学部'?100:150),g('japanese'),k==='math'?math():g(k)]));
   if(faculty==='文学部')choices=['history','geography'].map(k=>choose(k,'英語＋国語＋'+label[k],[g('englishR'),g('japanese'),g(k)]));
   if(faculty==='国際日本学部'&&dep.endsWith('2'))choices=[choose('standard','英語＋国語',[g('englishR',200),g('japanese',150)])];
   if(choices.length)official('meiji','2027年度入試ガイドの学部別入試を参照。'+(faculty==='理工学部'?'理科は物理または化学の3題に集中する形で集約しています。':'数学の範囲内の配分はゲーム用に集約しています。'));
  }
  if(faculty==='経営学部'&&dep.includes('共テ併3')){choices=['history','geography','civics','mathI','mathII','information'].map(k=>choose(k,'個別：英語・国語／共テ：'+label[k],[g('englishR',150),g('japanese')],[g(k)],{individualShare:250/350}));official('meiji','2027年度の共通テスト併用型3科目方式。共テは指定範囲から選んだ1科目だけを使用します。');}
 }
 if(u.name==='中央大学'&&faculty==='総合政策学部'&&/一般2/.test(dep)&&!hasCommon){choices=[choose('standard','英語＋国語',[g('englishR',150),g('japanese')],[],{englishMinimum:true})];official('chuo','2027年度の一般方式。英語の基準点は公表されていないため、英語不足の追加減衰はゲーム設定です。');}
 if(u.name==='早稲田大学'&&faculty==='政治経済学部'&&dep.includes('併用')){
  choices=['history','geography','civics','physics','chemistry','biology','information','mathII'].map(k=>choose(k,'総合問題＋共テ選択：'+label[k],[{name:'総合問題（国語・英語で集約）',points:100,parts:{japanese:.5,englishR:.5}}],[g('japanese',25),g('mathI',25),english(25),g(k,25)],{individualShare:.5}));official('waseda','2027年度の共テ必須3科目と選択1科目、総合問題を区別。総合問題の採点はゲーム用に集約します。');
 }
 if(!choices.length){
  status='model';source=null;
  let count=Number(r.subjectCount);if(!Number.isInteger(count)||count<1||count>9)count=3;
  const ctCount=Number((r.pattern||'').match(/-(\d+)(?:,\d+)?$/)?.[1])||3;
  const privateCommon=()=>{const pool=science?[english(),g('mathI'),g('mathII'),g(sci[0]),g(sci[1]),g('information'),g('japanese',200),g(social)]:[english(),g('japanese',200),g(social),g('mathI'),g('mathII'),g('information'),g(sci[0]),g(second)];return pool.slice(0,Math.min(pool.length,ctCount));};
  const common=hasCommon?(u.type==='私立'?privateCommon():standardCommon):[];
  if(commonOnly)choices=[choose('standard','共通テストのみ',[],common)];
  else if(science){
   const keys=count===3?sci:['none'];
   choices=keys.map(k=>{let subjects=count===1?[math(advanced)]:[g('englishR'),math(advanced)];if(count===3)subjects.push(g(k));if(count>=4)subjects.push(...sci.map(x=>g(x)));if(['東京大学','京都大学'].includes(u.name))subjects.push(g('japanese'));return choose(k==='none'?'standard':k,subjects.map(x=>x.name).join('＋'),subjects,common);});
  }else{
   const alternatives=count>=3?['history','geography','civics','math']:[null];
   choices=alternatives.map(k=>{let subjects=count===1?[g('englishR')]:[g('englishR'),g('japanese')];if(k)subjects.push(k==='math'?math():g(k));if(count>=4)subjects.push(k==='math'?g(social):math());if(u.name==='東京大学')subjects=[g('japanese'),g('englishR'),math(),g(social),g(second)];return choose(k||'standard',subjects.map(x=>x.name).join('＋'),subjects,common);});
  }
  if(u.foreign)choices=[choose('standard','語学・学力・活動実績',science?[g('englishR'),g('englishL'),math(true),g(sci[0])]:[g('englishR'),g('englishL'),g('japanese'),math()],[])];
  // Two on-campus exams do not mean that external English is waived.
  if(u.name==='立教大学'&&!hasCommon&&!u.foreign){
   source=sources.rikkyo;status='partial';note='一般入試の英語は共テ成績を利用する経路で再現。独自2科目に英語を追加して判定します。科目選択・配点は代表モデルです。';
   choices=science?sci.map(k=>choose(k,'数学＋'+label[k]+'＋共テ英語',[math(advanced),g(k)], [english()],{externalEnglish:true})):['history','geography','civics','math'].map(k=>choose(k,'国語＋'+(k==='math'?'数学':label[k])+'＋共テ英語',[g('japanese'),k==='math'?math():g(k)],[english()],{externalEnglish:true}));
  }
  if(/英語外部|英語4|4技能|併英|全学英|学部別英/.test(dep)){note+=' 外部英語のCSE等は未収録のため、英語能力を追加評価する代表モデルです。実際の出願条件の代用ではありません。';for(const v of choices){if(!v.individual.some(x=>x.parts.englishR))v.individual.push(g('englishR'));}}
 }
 return choices.map(v=>({...v,source,status,note,science,context:sel,usesCommon:hasCommon||!!v.externalEnglish,commonOnly,math3:v.individual.some(x=>x.parts.mathIII),individualShare:v.individualShare??.65}));
}
function resolve(s,u,c,r,selection){const ctx=context(s,selection?.context),all=variants(s,u,c,r,ctx);let selected=all.find(v=>v.id===selection?.option);if(!selected)selected=all.find(v=>v.id===ctx.socialSubject)||all.find(v=>v.id===ctx.sciencePair.split(',')[0])||all[0];return {...selected,options:all.map(v=>({id:v.id,name:v.name})),selection:{option:selected.id,context:{...ctx}}};}
function weights(groups){const out={};for(const group of groups)for(const[k,v]of Object.entries(group.parts))out[k]=(out[k]||0)+v*group.points;return out;}
root.LifeAdmissionRules={sources,variants,resolve,context,validContext,weights,isScience,mathKeys};
})(typeof window!=='undefined'?window:globalThis);
