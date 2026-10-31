/** Disposable QA preloader only: outbound calls cannot leave this local test process. */
const original=globalThis.fetch;
globalThis.fetch=async(input,init)=>{const address=input instanceof Request?input.url:String(input);const url=new URL(address);if(url.hostname==='openrouter.ai')return Response.json({data:{is_management_key:false,is_provisioning_key:false,limit:100,limit_remaining:100,limit_reset:null,is_free_tier:false}});if(!['localhost','127.0.0.1','::1'].includes(url.hostname))return new Response('Synthetic QA blocks outbound requests',{status:503});return original(input,init);};
export {};
