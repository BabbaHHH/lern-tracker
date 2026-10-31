import { AccountApp } from "@/components/account-app";
export default async function Page({searchParams}:{searchParams:Promise<{token?:string}>}) {
  const params=await searchParams;return <AccountApp mode="reset" token={params.token||""}/>;
}
