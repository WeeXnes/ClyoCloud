import torch
import torch.nn.functional as F

class EdgePadOutpaint:
    """
    Outpaint Padding Node that replicates/smears the boundary pixels (leftmost and rightmost)
    across the entire outpainted padding area, matching background lighting, colors, and gradients
    seamlessly instead of filling with neutral gray or white.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "mode": (["Target Aspect Ratio", "Explicit Padding"], {"default": "Target Aspect Ratio"}),
                "target_aspect": ([
                    "16:10 (2880x1800 Wallpaper)",
                    "16:9 (Widescreen)",
                    "21:9 (Ultrawide)",
                    "4:3 (Classic)",
                    "1:1 (Square)",
                    "Custom Ratio"
                ], {"default": "16:10 (2880x1800 Wallpaper)"}),
                "custom_aspect_ratio": ("FLOAT", {"default": 1.6, "min": 0.1, "max": 10.0, "step": 0.01}),
                "alignment": (["center", "left", "right"], {"default": "center"}),
                "feathering": ("INT", {"default": 48, "min": 0, "max": 512, "step": 1}),
                "pad_left": ("INT", {"default": 0, "min": 0, "max": 8192, "step": 8}),
                "pad_right": ("INT", {"default": 0, "min": 0, "max": 8192, "step": 8}),
                "pad_top": ("INT", {"default": 0, "min": 0, "max": 8192, "step": 8}),
                "pad_bottom": ("INT", {"default": 0, "min": 0, "max": 8192, "step": 8}),
                "multiple_of": ("INT", {"default": 16, "min": 8, "max": 64, "step": 8}),
            }
        }

    RETURN_TYPES = ("IMAGE", "MASK", "INT", "INT", "INT", "INT", "INT", "INT")
    RETURN_NAMES = ("image", "mask", "pad_left", "pad_right", "pad_top", "pad_bottom", "inner_width", "inner_height")
    FUNCTION = "pad_edges"
    CATEGORY = "image/outpaint"

    def pad_edges(self, image, mode, target_aspect, custom_aspect_ratio, alignment,
                  feathering, pad_left, pad_right, pad_top, pad_bottom, multiple_of):
        
        B, H, W, C = image.shape
        inner_width = W
        inner_height = H
        
        if mode == "Target Aspect Ratio":
            aspect_map = {
                "16:10 (2880x1800 Wallpaper)": 16.0 / 10.0,
                "16:9 (Widescreen)": 16.0 / 9.0,
                "21:9 (Ultrawide)": 21.0 / 9.0,
                "4:3 (Classic)": 4.0 / 3.0,
                "1:1 (Square)": 1.0,
                "Custom Ratio": custom_aspect_ratio,
            }
            target_ratio = aspect_map.get(target_aspect, 1.6)
            current_ratio = W / H
            
            if current_ratio < target_ratio:
                # Need horizontal padding (left & right)
                target_w = int(round(H * target_ratio))
                target_w = ((target_w + multiple_of - 1) // multiple_of) * multiple_of
                total_pad_w = max(0, target_w - W)
                
                if alignment == "center":
                    pad_left = ((total_pad_w // 2) // 8) * 8
                    pad_right = total_pad_w - pad_left
                elif alignment == "left":
                    pad_left = 0
                    pad_right = total_pad_w
                else:  # right
                    pad_left = total_pad_w
                    pad_right = 0
                    
                pad_top = 0
                pad_bottom = 0
            else:
                pad_left = 0
                pad_right = 0
                pad_top = 0
                pad_bottom = 0
        else:
            pad_left = ((pad_left + 7) // 8) * 8
            pad_right = ((pad_right + 7) // 8) * 8
            pad_top = ((pad_top + 7) // 8) * 8
            pad_bottom = ((pad_bottom + 7) // 8) * 8
            
        # 1. Edge replicate padding along horizontal axis
        chunks_h = []
        if pad_left > 0:
            left_col = image[:, :, 0:1, :].repeat(1, 1, pad_left, 1)
            chunks_h.append(left_col)
            
        chunks_h.append(image)
        
        if pad_right > 0:
            right_col = image[:, :, -1:, :].repeat(1, 1, pad_right, 1)
            chunks_h.append(right_col)
            
        padded_h = torch.cat(chunks_h, dim=2) if len(chunks_h) > 1 else image
        
        # 2. Edge replicate padding along vertical axis (if any)
        chunks_v = []
        if pad_top > 0:
            top_row = padded_h[:, 0:1, :, :].repeat(1, pad_top, 1, 1)
            chunks_v.append(top_row)
            
        chunks_v.append(padded_h)
        
        if pad_bottom > 0:
            bottom_row = padded_h[:, -1:, :, :].repeat(1, pad_bottom, 1, 1)
            chunks_v.append(bottom_row)
            
        padded_image = torch.cat(chunks_v, dim=1) if len(chunks_v) > 1 else padded_h
        
        # 3. Generate ComfyUI outpainting MASK for SetLatentNoiseMask
        total_H = H + pad_top + pad_bottom
        total_W = W + pad_left + pad_right
        
        mask = torch.ones((B, total_H, total_W), dtype=torch.float32, device=image.device)
        inner_mask = torch.zeros((H, W), dtype=torch.float32, device=image.device)
        
        if feathering > 0:
            dist_l = torch.arange(W, device=image.device).unsqueeze(0).expand(H, W) if pad_left > 0 else torch.full((H, W), feathering, device=image.device)
            dist_r = torch.flip(torch.arange(W, device=image.device), dims=[0]).unsqueeze(0).expand(H, W) if pad_right > 0 else torch.full((H, W), feathering, device=image.device)
            dist_t = torch.arange(H, device=image.device).unsqueeze(1).expand(H, W) if pad_top > 0 else torch.full((H, W), feathering, device=image.device)
            dist_b = torch.flip(torch.arange(H, device=image.device), dims=[0]).unsqueeze(1).expand(H, W) if pad_bottom > 0 else torch.full((H, W), feathering, device=image.device)
            
            min_dist = torch.minimum(torch.minimum(dist_l, dist_r), torch.minimum(dist_t, dist_b))
            blend = torch.clamp((feathering - min_dist).float() / feathering, min=0.0, max=1.0)
            inner_mask = blend * blend
            
        mask[:, pad_top:pad_top+H, pad_left:pad_left+W] = inner_mask
        
        return (padded_image, mask, pad_left, pad_right, pad_top, pad_bottom, inner_width, inner_height)


class SeamlessOutpaintBlend:
    """
    Seamlessly blends the original sharp input image back onto the decoded outpainted image.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "original_padded": ("IMAGE",),
                "generated_outpaint": ("IMAGE",),
                "pad_left": ("INT", {"default": 0, "min": 0, "max": 8192}),
                "pad_right": ("INT", {"default": 0, "min": 0, "max": 8192}),
                "pad_top": ("INT", {"default": 0, "min": 0, "max": 8192}),
                "pad_bottom": ("INT", {"default": 0, "min": 0, "max": 8192}),
                "inner_width": ("INT", {"default": 720, "min": 64, "max": 8192}),
                "inner_height": ("INT", {"default": 1280, "min": 64, "max": 8192}),
                "feather_radius": ("INT", {"default": 48, "min": 4, "max": 256, "step": 4}),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "blend"
    CATEGORY = "image/outpaint"

    def blend(self, original_padded, generated_outpaint, pad_left, pad_right, pad_top, pad_bottom,
              inner_width, inner_height, feather_radius):
        
        B, H, W, C = original_padded.shape
        feather = max(4, feather_radius)
        
        x_coords = torch.arange(W, device=original_padded.device).view(1, 1, W, 1)
        y_coords = torch.arange(H, device=original_padded.device).view(1, H, 1, 1)
        
        dist_l = (x_coords - pad_left) if pad_left > 0 else torch.full_like(x_coords, feather)
        dist_r = ((pad_left + inner_width) - x_coords) if pad_right > 0 else torch.full_like(x_coords, feather)
        dist_t = (y_coords - pad_top) if pad_top > 0 else torch.full_like(y_coords, feather)
        dist_b = ((pad_top + inner_height) - y_coords) if pad_bottom > 0 else torch.full_like(y_coords, feather)
        
        min_dist_h = torch.minimum(dist_l, dist_r)
        min_dist_v = torch.minimum(dist_t, dist_b)
        min_dist = torch.minimum(min_dist_h, min_dist_v)
        
        t = torch.clamp(min_dist.float() / feather, 0.0, 1.0)
        alpha = t * t * (3.0 - 2.0 * t)
        
        blended = original_padded * alpha + generated_outpaint * (1.0 - alpha)
        return (blended.clamp(0.0, 1.0),)


class HighResOriginalComposite:
    """
    Composites the 100% RAW uncompressed input photograph directly onto the final
    upscaled 2880x1800 wallpaper.
    This guarantees:
    - ZERO loss of facial sharpness, skin pores, eye reflections, or fine lines.
    - Zero VAE compression artifact or neural upscaler plastic/smudge look on the woman.
    - The background is seamlessly extended across an imperceptible smoothstep transition.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "raw_original_image": ("IMAGE",),
                "wallpaper": ("IMAGE",),
                "crop_position": (["center", "top", "bottom"], {"default": "center"}),
                "feather_radius": ("INT", {"default": 64, "min": 8, "max": 256, "step": 8}),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "composite"
    CATEGORY = "image/outpaint"

    def composite(self, raw_original_image, wallpaper, crop_position, feather_radius):
        B_w, H_w, W_w, C_w = wallpaper.shape
        B_r, H_r, W_r, C_r = raw_original_image.shape
        
        # Scale raw original so that height matches wallpaper height H_w (e.g. 1800)
        scale = H_w / H_r
        new_w = int(round(W_r * scale))
        new_h = H_w
        
        # Resize raw image using bicubic antialiasing
        x = raw_original_image.permute(0, 3, 1, 2)
        scaled_raw = F.interpolate(x, size=(new_h, new_w), mode="bicubic", align_corners=False, antialias=True)
        scaled_raw = scaled_raw.permute(0, 2, 3, 1).clamp(0.0, 1.0)
        
        # Determine horizontal placement in wallpaper canvas
        x0 = max(0, (W_w - new_w) // 2)
        actual_w = min(new_w, W_w - x0)
        
        # Create 1D smoothstep alpha mask across the width
        x_coords = torch.arange(W_w, device=wallpaper.device)
        dist_l = torch.clamp((x_coords - x0).float(), min=0.0)
        dist_r = torch.clamp(((x0 + actual_w) - x_coords).float(), min=0.0)
        min_dist = torch.minimum(dist_l, dist_r)
        
        inside = (x_coords >= x0) & (x_coords < x0 + actual_w)
        feather = max(8, feather_radius)
        t = torch.clamp(min_dist / feather, 0.0, 1.0)
        alpha_1d = torch.where(inside, t * t * (3.0 - 2.0 * t), torch.zeros_like(t))
        alpha = alpha_1d.view(1, 1, W_w, 1)
        
        # Embed scaled raw image into wallpaper dimensions
        embedded_raw = wallpaper.clone()
        embedded_raw[:, :, x0:x0+actual_w, :] = scaled_raw[:, :, :actual_w, :]
        
        # Final smooth composite
        out = embedded_raw * alpha + wallpaper * (1.0 - alpha)
        return (out.clamp(0.0, 1.0),)


class CropScalePortrait:
    """
    Crops and resizes an arbitrary input image to a fixed portrait resolution
    (e.g. 720x1280 or 832x1216) suitable for high-res SDXL / Inpainting models.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "target_width": ("INT", {"default": 720, "min": 64, "max": 4096, "step": 8}),
                "target_height": ("INT", {"default": 1280, "min": 64, "max": 4096, "step": 8}),
                "crop_position": (["center", "top", "bottom"], {"default": "center"}),
                "scaling_method": (["crop to fill", "fit within (pad)", "stretch"], {"default": "crop to fill"}),
                "interpolation": (["bicubic", "bilinear", "nearest"], {"default": "bicubic"}),
            }
        }

    RETURN_TYPES = ("IMAGE", "INT", "INT")
    RETURN_NAMES = ("image", "width", "height")
    FUNCTION = "crop_scale"
    CATEGORY = "image/transform"

    def crop_scale(self, image, target_width, target_height, crop_position, scaling_method, interpolation):
        B, H, W, C = image.shape
        
        target_w = ((target_width + 7) // 8) * 8
        target_h = ((target_height + 7) // 8) * 8
        
        if scaling_method == "stretch":
            x = image.permute(0, 3, 1, 2)
            align = False if interpolation in ["bicubic", "bilinear"] else None
            resized = F.interpolate(x, size=(target_h, target_w), mode=interpolation, align_corners=align, antialias=True if interpolation != "nearest" else False)
            out = resized.permute(0, 2, 3, 1).clamp(0.0, 1.0)
            return (out, target_w, target_h)
            
        elif scaling_method == "crop to fill":
            target_ratio = target_w / target_h
            input_ratio = W / H
            
            if input_ratio > target_ratio:
                scale = target_h / H
                new_w = int(round(W * scale))
                new_h = target_h
            else:
                scale = target_w / W
                new_w = target_w
                new_h = int(round(H * scale))
                
            x = image.permute(0, 3, 1, 2)
            align = False if interpolation in ["bicubic", "bilinear"] else None
            resized = F.interpolate(x, size=(new_h, new_w), mode=interpolation, align_corners=align, antialias=True if interpolation != "nearest" else False)
            resized = resized.permute(0, 2, 3, 1).clamp(0.0, 1.0)
            
            if new_w > target_w:
                diff = new_w - target_w
                if crop_position == "center":
                    x0 = diff // 2
                elif crop_position == "left":
                    x0 = 0
                else:
                    x0 = diff
                out = resized[:, :, x0:x0+target_w, :]
            elif new_h > target_h:
                diff = new_h - target_h
                if crop_position == "center":
                    y0 = diff // 2
                elif crop_position == "top":
                    y0 = 0
                else:
                    y0 = diff
                out = resized[:, y0:y0+target_h, :, :]
            else:
                out = resized
                
            return (out, target_w, target_h)
            
        else:
            target_ratio = target_w / target_h
            input_ratio = W / H
            
            if input_ratio > target_ratio:
                scale = target_w / W
                new_w = target_w
                new_h = int(round(H * scale))
            else:
                scale = target_h / H
                new_w = int(round(W * scale))
                new_h = target_h
                
            x = image.permute(0, 3, 1, 2)
            align = False if interpolation in ["bicubic", "bilinear"] else None
            resized = F.interpolate(x, size=(new_h, new_w), mode=interpolation, align_corners=align, antialias=True if interpolation != "nearest" else False)
            resized = resized.permute(0, 2, 3, 1).clamp(0.0, 1.0)
            
            out = torch.zeros((B, target_h, target_w, C), dtype=torch.float32, device=image.device)
            y0 = (target_h - new_h) // 2
            x0 = (target_w - new_w) // 2
            out[:, y0:y0+new_h, x0:x0+new_w, :] = resized
            return (out, target_w, target_h)


class EnvironmentPromptSelector:
    """
    Selects prompt conditioning specifically for Outdoor vs Indoor scenes,
    preventing indoor bedroom furniture from appearing in outdoor beach/nature pictures.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "environment": (["Outdoor (Nature / Landscape / Daylight)", "Indoor (Room / Suite / Bedroom)", "Custom / Manual"], {"default": "Outdoor (Nature / Landscape / Daylight)"}),
                "custom_positive": ("STRING", {"multiline": True, "default": ""}),
                "custom_negative": ("STRING", {"multiline": True, "default": ""}),
            }
        }

    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("positive", "negative")
    FUNCTION = "get_prompts"
    CATEGORY = "conditioning"

    def get_prompts(self, environment, custom_positive, custom_negative):
        if environment == "Outdoor (Nature / Landscape / Daylight)":
            base_pos = (
                "photorealistic, ultra detailed 8k wallpaper, beautiful woman posing outdoors, "
                "scenic outdoor environment, matching landscape, natural sunlight, soft daylight, "
                "lush trees, sky, depth of field, summer daylight, masterpiece, highly detailed background"
            )
            base_neg = (
                "indoor, room, bedroom, ceiling, walls, furniture, interior, bed, curtains, "
                "blurry, low quality, artifacts, watermark, logo, text, distorted, mutilated, disfigured, "
                "bad anatomy, cartoon, anime, 3d render"
            )
        elif environment == "Indoor (Room / Suite / Bedroom)":
            base_pos = (
                "photorealistic, ultra detailed 8k wallpaper, beautiful woman posing indoors, "
                "matching luxurious room background, modern aesthetic interior, soft warm ambient lighting, "
                "elegant room decor, depth of field, masterpiece, highly detailed interior"
            )
            base_neg = (
                "outdoor, sky, trees, nature, grass, landscape, exterior, garden, sun, "
                "blurry, low quality, artifacts, watermark, logo, text, distorted, mutilated, disfigured, "
                "bad anatomy, cartoon, anime, 3d render"
            )
        else:
            base_pos = custom_positive or "photorealistic, ultra detailed 8k wallpaper, beautiful woman portrait, matching surrounding environment, masterpiece, 8k uhd"
            base_neg = custom_negative or "blurry, low quality, artifacts, watermark, distorted, mutilated, cartoon, anime"

        if custom_positive.strip() and environment != "Custom / Manual":
            pos = f"{base_pos}, {custom_positive.strip()}"
        else:
            pos = base_pos

        if custom_negative.strip() and environment != "Custom / Manual":
            neg = f"{base_neg}, {custom_negative.strip()}"
        else:
            neg = base_neg

        return (pos, neg)


class SeamlessPadForOutpaint:
    SEARCH_ALIASES = ["seamless outpaint pad", "edge replicate pad", "pad outpaint"]

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "left": ("INT", {"default": 320, "min": 0, "max": 16384, "step": 8}),
                "top": ("INT", {"default": 0, "min": 0, "max": 16384, "step": 8}),
                "right": ("INT", {"default": 320, "min": 0, "max": 16384, "step": 8}),
                "bottom": ("INT", {"default": 0, "min": 0, "max": 16384, "step": 8}),
                "feathering": ("INT", {"default": 48, "min": 0, "max": 16384, "step": 1}),
                "fill_mode": (["replicate_edge", "reflect", "wrap", "mean"], {"default": "replicate_edge"}),
            }
        }

    RETURN_TYPES = ("IMAGE", "MASK")
    RETURN_NAMES = ("IMAGE", "MASK")
    FUNCTION = "pad_image"
    CATEGORY = "image/outpaint"

    def pad_image(self, image, left, top, right, bottom, feathering, fill_mode="replicate_edge"):
        B, H, W, C = image.shape
        if left == 0 and top == 0 and right == 0 and bottom == 0:
            mask = torch.zeros((B, H, W), dtype=torch.float32, device=image.device)
            return (image, mask)

        if fill_mode == "replicate_edge":
            x = image.permute(0, 3, 1, 2)
            padded = F.pad(x, (left, right, top, bottom), mode="replicate")
            new_image = padded.permute(0, 2, 3, 1)
        elif fill_mode == "reflect":
            x = image.permute(0, 3, 1, 2)
            padded = F.pad(x, (left, right, top, bottom), mode="reflect")
            new_image = padded.permute(0, 2, 3, 1)
        elif fill_mode == "wrap":
            x = image.permute(0, 3, 1, 2)
            padded = F.pad(x, (left, right, top, bottom), mode="circular")
            new_image = padded.permute(0, 2, 3, 1)
        elif fill_mode == "mean":
            mean_c = image.mean(dim=(1, 2), keepdim=True)
            new_image = mean_c.expand(B, H + top + bottom, W + left + right, C).clone()
            new_image[:, top:top+H, left:left+W, :] = image
        else:
            x = image.permute(0, 3, 1, 2)
            padded = F.pad(x, (left, right, top, bottom), mode="replicate")
            new_image = padded.permute(0, 2, 3, 1)

        new_H = H + top + bottom
        new_W = W + left + right
        mask = torch.ones((B, new_H, new_W), dtype=torch.float32, device=image.device)
        t = torch.zeros((H, W), dtype=torch.float32, device=image.device)

        if feathering > 0 and feathering * 2 < H and feathering * 2 < W:
            for i in range(H):
                for j in range(W):
                    dt = i if top != 0 else H
                    db = H - 1 - i if bottom != 0 else H
                    dl = j if left != 0 else W
                    dr = W - 1 - j if right != 0 else W
                    d = min(dt, db, dl, dr)
                    if d < feathering:
                        v = (feathering - d) / feathering
                        t[i, j] = v * v

        mask[:, top:top+H, left:left+W] = t.unsqueeze(0).expand(B, H, W)
        return (new_image, mask)
