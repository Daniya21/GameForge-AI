"use client";

import FeatureTool from "../components/FeatureTool";

export default function StoryPage() {
  return (
    <FeatureTool
      config={{
        title: "Story Generator",
        eyebrow: "Narrative engine",
        description:
          "Create a focused game story that understands your exact premise and develops it into a coherent world, conflict, three-act arc, twist, and complete ending.",
        image: "/cards/story.png",
        accent: "#c084fc",
        button: "Generate Story",
        resultTitle: "Your Story Blueprint",
        projectSection: "story",
        fields: [
          {
            name: "premise",
            label: "Core premise",
            placeholder:
              "Example: After a long and brutal war, the exhausted kingdom finally wins—but its returning soldiers discover that peace may be harder to survive than battle.",
            type: "textarea",
          },
          {
            name: "genre",
            label: "Genre",
            placeholder: "",
            type: "select",
            options: ["Fantasy", "Sci-Fi", "Horror", "Adventure", "Mystery", "Cyberpunk"],
          },
          {
            name: "tone",
            label: "Tone",
            placeholder: "",
            type: "select",
            options: ["Epic", "Dark", "Hopeful", "Emotional", "Mysterious", "Comedic"],
          },
        ],
        generateResult: async (values) => {
          const response = await fetch("/api/story", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              premise: values.premise,
              genre: values.genre,
              tone: values.tone,
            }),
          });

          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
            sections?: Array<{ title: string; content: string }>;
          };

          if (!response.ok) {
            throw new Error(payload.error || "The Story AI could not generate a result.");
          }

          if (!payload.sections?.length) {
            throw new Error("The Story AI returned an empty result.");
          }

          return payload.sections;
        },
      }}
    />
  );
}
