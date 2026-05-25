export default function ProfilePage({
  params,
}: {
  params: { id: string }
}) {
  return (
    <main className="p-10 text-white">
      <h1 className="text-3xl font-bold">
        {params.id}'s Profile
      </h1>
    </main>
  )
}