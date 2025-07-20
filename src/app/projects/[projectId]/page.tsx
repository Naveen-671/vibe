interface Props {
  params: Promise<{
    projectId: string;
  }>;
}

const Page = async ({ params }: Props) => {
  const { projectId } = await params;

  return <div className="">Project id: {projectId}</div>;
};

export default Page;
