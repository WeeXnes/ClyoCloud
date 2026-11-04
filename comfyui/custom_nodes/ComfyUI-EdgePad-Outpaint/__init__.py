from .edge_pad_nodes import (
    EdgePadOutpaint,
    CropScalePortrait,
    SeamlessOutpaintBlend,
    HighResOriginalComposite,
    EnvironmentPromptSelector,
    SeamlessPadForOutpaint,
)

NODE_CLASS_MAPPINGS = {
    "EdgePadOutpaint": EdgePadOutpaint,
    "CropScalePortrait": CropScalePortrait,
    "SeamlessOutpaintBlend": SeamlessOutpaintBlend,
    "HighResOriginalComposite": HighResOriginalComposite,
    "EnvironmentPromptSelector": EnvironmentPromptSelector,
    "SeamlessPadForOutpaint": SeamlessPadForOutpaint,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "EdgePadOutpaint": "Edge Replicate Pad (Outpaint)",
    "CropScalePortrait": "Crop & Scale (Portrait)",
    "SeamlessOutpaintBlend": "Seamless Outpaint Blend",
    "HighResOriginalComposite": "High-Res Original Composite (Pristine Face)",
    "EnvironmentPromptSelector": "Environment Prompt Selector",
    "SeamlessPadForOutpaint": "Seamless Pad For Outpaint",
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
