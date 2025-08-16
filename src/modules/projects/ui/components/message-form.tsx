// import { useForm } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";
// import { z } from "zod";
// import { toast } from "sooner";
// import { useState } from "react";
// import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
// import { cn } from "@/lib/utils";
// import { useTRPC } from "@/trpc/client";
// import { Button } from "@/components/ui/button";
// import { ArrowUpIcon, Loader2Icon } from "lucide-react";
// import TextareaAutoSize from "react-textarea-autosize";
// import { Form, FormField } from "@/components/ui/form";
// import { Usage } from "./usage";
// import { useRouter } from "next/navigation";

// interface Props {
//   projectId: string;
// }

// const formSchema = z.object({
//   value: z
//     .string()
//     .min(1, { message: "Value is required" })
//     .max(10000, { message: "Value is too long" })
// });

// export const MessageForm = ({ projectId }: Props) => {
//   const trpc = useTRPC();
//   const queryClient = useQueryClient();
//   const router = useRouter();
//   const { data: usage } = useQuery(trpc.usage.status.queryOptions());
//   const [isFocused, setIsFocused] = useState(false);
//   const showUsage = !!usage;

//   const form = useForm<z.infer<typeof formSchema>>({
//     resolver: zodResolver(formSchema),
//     defaultValues: { value: "" }
//   });

//   const createMessage = useMutation(
//     trpc.messages.create.mutationOptions({
//       onSuccess: () => {
//         form.reset();
//         queryClient.invalidateQueries(
//           trpc.messages.getMany.queryOptions({ projectId })
//         );
//         queryClient.invalidateQueries(trpc.usage.status.queryOptions());
//       },
//       onError: (error) => {
//         toast.error(error.message);

//         if (error.data?.code === "TOO_MANY_REQUESTS") {
//           router.push("/pricing");
//         }
//       }
//     })
//   );

//   const onSubmit = async (values: z.infer<typeof formSchema>) => {
//     await createMessage.mutateAsync({
//       value: values.value,
//       projectId
//     });
//   };

//   const isPending = createMessage.isPending;
//   const isButtonDisabled = isPending || !form.formState.isValid;

//   return (
//     <Form {...form}>
//       {showUsage && (
//         <Usage
//           points={usage.remainingPoints}
//           msBeforeNext={usage.msBeforeNext}
//         />
//       )}
//       <form
//         onSubmit={form.handleSubmit(onSubmit)}
//         className={cn(
//           "relative border p-4 pt-1 rounded-xl bg-sidebar dark:bg-sidebar transition-all",
//           isFocused && "shadow-xs",
//           showUsage && "rounded-t-none"
//         )}
//       >
//         <FormField
//           control={form.control}
//           name="value"
//           render={({ field }) => (
//             <TextareaAutoSize
//               {...field}
//               disabled={isPending}
//               placeholder="What would you like to build?"
//               className="w-full pt-4 resize-none border-none outline-none bg-transparent"
//               minRows={2}
//               maxRows={8}
//               onFocus={() => setIsFocused(true)}
//               onBlur={() => setIsFocused(false)}
//               onKeyDown={(e) => {
//                 if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
//                   e.preventDefault();
//                   form.handleSubmit(onSubmit)(e);
//                 }
//               }}
//             />
//           )}
//         />
//         <div className="flex gap-x-2 items-end justify-between pt-2">
//           <div className="text-[10px] text-muted-foreground font-mono">
//             <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
//               <span>&#8984;</span>Enter
//             </kbd>
//             &nbsp;to submit
//           </div>
//           <Button
//             disabled={isButtonDisabled}
//             className={cn(
//               "size-8 rounded-full",
//               isButtonDisabled && "bg-muted-foreground border"
//             )}
//           >
//             {isPending ? (
//               <Loader2Icon className="size-4 animate-spin" />
//             ) : (
//               <ArrowUpIcon />
//             )}
//           </Button>
//         </div>
//       </form>
//     </Form>
//   );
// };


import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { ArrowUp, Loader2 } from "lucide-react";
import TextareaAutoSize from "react-textarea-autosize";
import { Form, FormField, FormControl } from "@/components/ui/form";
import { Usage } from "./usage";
import { ModelSelector, allModels } from "@/modules/projects/ui/components/model-selector"
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Props {
  projectId: string;
  isPremium: boolean; // Add this prop
}

const formSchema = z.object({
  value: z.string().min(1, { message: "Value is required" })
});

export const MessageForm = ({ projectId, isPremium }: Props) => {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const defaultModel = allModels.find((m) => m.isDefault) || allModels[0];
  const [selectedModel, setSelectedModel] = useState<string>(defaultModel.id);
  const [isFocused, setIsFocused] = useState(false);

  const { data: usage } = useQuery(trpc.usage.status.queryOptions());
  const showUsage = !!usage;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { value: "" }
  });

  const createMessage = useMutation(
    trpc.messages.create.mutationOptions({
      onSuccess: () => {
        form.reset();
        queryClient.invalidateQueries(
          trpc.messages.getMany.queryOptions({ projectId })
        );
        queryClient.invalidateQueries(trpc.usage.status.queryOptions());
      },
      onError: (error) => {
        toast.error(error.message);
        if (error.data?.code === "TOO_MANY_REQUESTS") {
          router.push("/pricing");
        }
      }
    })
  );

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    await createMessage.mutateAsync({
      value: values.value,
      projectId,
      model: selectedModel
    });
  };

  const isPending = createMessage.isPending;
  const isButtonDisabled = isPending || !form.formState.isValid;

  return (
    <div>
      {showUsage && usage && (
        <Usage
          points={usage.remainingPoints}
          msBeforeNext={usage.msBeforeNext}
        />
      )}

      <Form {...form}>
        <div
          className={cn(
            "border-x border-t rounded-t-xl bg-sidebar dark:bg-sidebar px-4 py-3",
            showUsage && "border-t-0 rounded-t-none"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              AI Model
            </span>
            <ModelSelector
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              isPremium={isPremium}
            />
          </div>
        </div>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className={cn(
            "relative border border-t-0 p-4 pt-1 rounded-b-xl bg-sidebar dark:bg-sidebar transition-all",
            isFocused && "shadow-xs"
          )}
        >
          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <FormControl>
                <TextareaAutoSize
                  {...field}
                  disabled={isPending}
                  placeholder="What would you like to build?"
                  className="w-full pt-4 resize-none border-none outline-none bg-transparent"
                  minRows={2}
                  maxRows={6}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      form.handleSubmit(onSubmit)();
                    }
                  }}
                />
              </FormControl>
            )}
          />
          <div className="flex gap-x-2 items-end justify-between pt-2">
            <div className="text-[10px] text-muted-foreground font-mono">
              <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span>&#8984;</span>Enter
              </kbd>
              &nbsp;to submit
            </div>
            <Button
              type="submit"
              disabled={isButtonDisabled}
              className={cn(
                "size-8 rounded-full",
                isButtonDisabled && "bg-muted-foreground border"
              )}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};