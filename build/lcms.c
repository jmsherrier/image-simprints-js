// Option (b) of the colour-profile test: an embedded ICC profile applied with littleCMS,
// as Pillow's ImageCms.profileToProfile(im, profile, createProfile("sRGB"), outputMode="RGB")
// (perceptual intent, no flags, 8-bit RGBA or grey in, RGBA out).
#include "lcms2.h"

int to_srgb(const void *icc, cmsUInt32Number size, int grey, const void *in, void *out, cmsUInt32Number n) {
    cmsHPROFILE p = cmsOpenProfileFromMem(icc, size);
    if (!p) return 1;
    cmsHPROFILE s = cmsCreate_sRGBProfile();
    cmsHTRANSFORM t = cmsCreateTransform(p, grey ? TYPE_GRAY_8 : TYPE_RGBA_8, s, TYPE_RGBA_8, INTENT_PERCEPTUAL, 0);
    cmsCloseProfile(p);
    cmsCloseProfile(s);
    if (!t) return 2;
    cmsDoTransform(t, in, out, n);
    cmsDeleteTransform(t);
    return 0;
}
