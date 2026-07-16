import { createClient } from '@supabase/supabase-js'

export default async function handler(req,res){
 if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
 const {email}=req.body;
 const supabase=createClient(process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
 const {data,error}=await supabase.auth.admin.listUsers();
 if(error) return res.status(500).json({error:error.message});
 const exists=data.users.some(u=>u.email?.toLowerCase()===email.toLowerCase());
 res.status(200).json({exists});
}
