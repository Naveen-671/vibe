"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sooner";

const Page = () => {
  const [value, setValue] = useState("");
  const router = useRouter();

  const trpc = useTRPC();

  const createProject = useMutation(
    trpc.projects.create.mutationOptions({
      onError: (error) => {
        toast.error(error.message);
      },
      onSuccess: (data) => {
        // router.push(`/projects/${data.id}`);
        console.log("Mutation successful, data:", data);

        // Check if data and data.id exist before pushing
        if (data?.id) {
          router.push(`/projects/${data.id}`);
        } else {
          toast.error("Failed to get project ID after creation.");
        }
      }
    })
  );

  return (
    <div className="h-screen w-screen flex items-center justify-center">
      <div className="max-7xl mx-auto flex items-center flex-col gap-y-4 justify-center">
        <Input value={value} onChange={(e) => setValue(e.target.value)} />
        <Button
          disabled={createProject.isPending}
          onClick={() => createProject.mutate({ value: value })}
        >
          Submit
        </Button>
      </div>
    </div>
  );
};

export default Page;
