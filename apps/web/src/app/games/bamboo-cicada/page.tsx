import { permanentRedirect } from "next/navigation";

import { bambooCicadaOfficialUrl } from "@/gameLinks";

export default function Page() {
  permanentRedirect(bambooCicadaOfficialUrl);
}
