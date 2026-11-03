import { v } from "convex/values";
import { fail } from "./lib/authz";
import { accountMutation } from "./lib/functions";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** An upload URL for a picture that doesn't belong to a trip yet (e.g. the cover chosen while creating one). */
export const generateImageUrl = accountMutation({
  args: {},
  handler: async (ctx) => ctx.storage.generateUploadUrl(),
});

/** The public URL of an image just uploaded with `generateImageUrl`; rejects anything that isn't a small image. */
export const imageUrl = accountMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const meta = await ctx.db.system.get(storageId);
    if (!meta) fail("not_found");
    if (!meta.contentType?.startsWith("image/") || meta.size > MAX_IMAGE_BYTES) {
      await ctx.storage.delete(storageId);
      fail("invalid", "image");
    }
    const url = await ctx.storage.getUrl(storageId);
    if (!url) fail("not_found");
    return url;
  },
});
