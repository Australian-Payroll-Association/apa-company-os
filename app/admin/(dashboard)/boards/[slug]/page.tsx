import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead } from "@/components/admin/PageHead";
import { getBoardBySlug, listBoardManageOptions } from "@/lib/boards/data";
import { BoardView } from "./BoardView";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = {
  title: "Board",
  description: "A task board.",
};

export default async function BoardDetailPage({ params }: { params: { slug: string } }) {
  const detail = await getBoardBySlug(params.slug);
  if (!detail) notFound();
  const options = await listBoardManageOptions();

  const { board } = detail;
  return (
    <>
      <PageHead
        eyebrow={<Link href="/admin/boards">← Boards</Link>}
        title={board.name}
        sub={
          board.client_name
            ? `Client board · ${board.client_name}`
            : "Cards move, promises get kept."
        }
      />
      <BoardView detail={detail} canManage teamOptions={options.team} clientOptions={options.clients} />
    </>
  );
}
