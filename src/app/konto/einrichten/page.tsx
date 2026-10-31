import { AccountApp } from "@/components/account-app";
export default async function Page({searchParams}:{searchParams:Promise<{token?:string;email?:string}>}) {
  const params=await searchParams;return <AccountApp mode="setup" token={params.token||""} invitedEmail={params.email||""}/>;
}
