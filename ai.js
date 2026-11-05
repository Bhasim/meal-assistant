/* Bring-your-own-key image adapters. Keys are held only in this closure, never persisted. */
(function () {
  'use strict';
  let session = {provider:'cloudflare',model:'gemma-4-26b-a4b-it'};
  const defaults = {cloudflare:'gemma-4-26b-a4b-it',openrouter:'openrouter/free',gemini:'gemini-2.5-flash',claude:'claude-haiku-4-5'};
  function configure({provider,key,model}) {
    if(!Object.hasOwn(defaults,provider))throw Error('الخدمة غير مدعومة.');
    if(provider==='cloudflare'){session={provider,model:defaults.cloudflare};return;}
    key=String(key||'').trim();model=String(model||defaults[provider]).trim();
    if(key.length<15||key.length>1000||/[\s\x00-\x1f]/.test(key))throw Error('أدخل مفتاح API صحيحًا، وليس كلمة مرور حسابك.');
    if(!/^[a-zA-Z0-9_./:-]{3,120}$/.test(model))throw Error('اسم النموذج غير صالح.');
    if(provider==='openrouter'&&model!=='openrouter/free'&&!model.endsWith(':free'))throw Error('هذا الخيار يقبل النماذج المجانية فقط: openrouter/free أو اسم ينتهي بـ :free.');
    if(provider!=='openrouter'&&model.includes('/'))throw Error('اكتب معرّف النموذج فقط دون رابط أو بادئة models/.');
    if(provider==='claude'&&!['127.0.0.1','localhost','[::1]'].includes(location.hostname))throw Error('لربط Claude شغّل python3 server.py وافتح عنوانه المحلي، ثم أدخل المفتاح هنا.');
    session={provider,key,model};
  }
  function parseJSON(text) {
    if(typeof text!=='string'||text.length>200000)throw Error('استجابة غير صالحة من خدمة التحليل.');
    const cleaned=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
    let result;
    try{result=JSON.parse(cleaned);}catch(e){const start=cleaned.indexOf('{'),end=cleaned.lastIndexOf('}');if(start<0||end<start)throw Error('لم تُعد الخدمة بيانات قابلة للقراءة. جرّب صورة أوضح أو نموذجًا آخر.');try{result=JSON.parse(cleaned.slice(start,end+1));}catch(e){throw Error('تعذّر قراءة بيانات التحليل.');}}
    if(!result||typeof result!=='object'||Array.isArray(result))throw Error('صيغة التحليل غير متوقعة.');
    return result;
  }
  async function encode(blob) {
    if(!blob||blob.type!=='image/jpeg'||blob.size>5*1024*1024)throw Error('الصورة غير صالحة أو كبيرة جدًا.');
    const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';
    for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
    return btoa(binary);
  }
  async function analyze(prompt,blob) {
    if(!session)throw Error('اربط خدمة الصور من الإعدادات أولًا.');
    // Snapshot the explicitly selected provider; switching/clearing later never redirects an in-flight upload.
    const config={...session},image=await encode(blob),controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),90000);
    try{
      let url,body,headers={'Content-Type':'application/json'};
      if(config.provider==='cloudflare'){
        url='https://meal-assistant-vision.hasimbaha00.workers.dev/';
        body={prompt,image};
      }else if(config.provider==='openrouter'){
        url='https://openrouter.ai/api/v1/chat/completions';headers.Authorization='Bearer '+config.key;
        body={model:config.model,max_tokens:4500,messages:[{role:'user',content:[{type:'text',text:prompt},{type:'image_url',image_url:{url:'data:image/jpeg;base64,'+image}}]}]};
      }else if(config.provider==='gemini'){
        url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(config.model)+':generateContent';headers['x-goog-api-key']=config.key;
        body={contents:[{parts:[{text:prompt},{inline_data:{mime_type:'image/jpeg',data:image}}]}],generationConfig:{responseMimeType:'application/json',maxOutputTokens:4500}};
      }else{
        url='/api/analyze';headers['X-Meal-Assistant']='1';
        body={provider:'claude',key:config.key,model:config.model,prompt,image,mime:'image/jpeg'};
      }
      const response=await fetch(url,{method:'POST',headers,body:JSON.stringify(body),signal:controller.signal,credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});
      if(!response.ok){
        const messages={400:'رفضت الخدمة الصورة أو النموذج. راجع اسم النموذج وصيغة الصورة.',401:'مفتاح API غير صحيح أو منتهي. أعد ضبطه في الإعدادات.',402:'لا يوجد رصيد أو لم تُتح خطة الاستخدام. لا يوجد انتقال تلقائي لنموذج مدفوع.',403:'حسابك أو منطقتك لا يسمحان بهذا الطلب. راجع إعدادات الخدمة.',404:config.provider==='claude'?'شغّل التطبيق بواسطة python3 server.py لربط Claude.':'النموذج غير موجود أو لم يعد متاحًا. حدّث اسمه في الإعدادات.',429:'بلغت حد الاستخدام أو حد السرعة. انتظر ثم أعد المحاولة؛ لم يتم تفعيل دفع تلقائي من التطبيق.'};
        throw Error(messages[response.status]||`تعذّر التحليل لدى المزوّد (HTTP ${response.status}). جرّب لاحقًا.`);
      }
      const data=await response.json();
      if(data.choices?.[0]?.finish_reason==='length'||data.candidates?.[0]?.finishReason==='MAX_TOKENS')throw Error('توقفت الاستجابة قبل اكتمالها؛ لم تُضف أي وجبة. جرّب صورة أبسط.');
      const text=config.provider==='openrouter'?data.choices?.[0]?.message?.content:config.provider==='gemini'?data.candidates?.[0]?.content?.parts?.filter(x=>typeof x.text==='string').map(x=>x.text).join('\n'):data.text;
      return parseJSON(text);
    }catch(e){
      if(e.name==='AbortError')throw Error('انتهت مهلة التحليل. لم تُحفظ وجبة؛ يمكنك المحاولة مجددًا.');
      if(e instanceof TypeError)throw Error('تعذّر الاتصال بالخدمة. تحقق من الإنترنت؛ ولـClaude استخدم الخادم المحلي المرفق.');
      throw e;
    }finally{clearTimeout(timer);}
  }
  globalThis.MealAssistantAI=Object.freeze({configure,disconnect(){session=null;},hasSession(){return Boolean(session);},analyze,parseJSON});
})();
