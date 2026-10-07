// Inline Touch ID for the APM desktop app.
//
// An LAContext paired with an LAAuthenticationView (macOS 12+) shows its prompt
// in that view instead of the system "… is trying to …" alert. This module
// puts the view over the lock screen's Touch ID button (mini, 16 pt) or the
// approval panel's glyph, so the fingerprint check runs in place, the way the
// macOS lock screen does it.
//
// It uses Node-API only, so one build loads in any Electron version. Build it
// with `npm run build:native`.
//
//   available()                                     -> boolean
//   start(handle, rect, dark, reason, cb[, glyphSize]) -> boolean, cb(ok, laErrorCode) once
//   move(rect, dark[, glyphSize])  (re-centres; the size stays the one start() picked)
//   cancel()
//
// handle is BrowserWindow#getNativeWindowHandle(). rect is in window points,
// measured from the top left, and the glyph is centred in it. glyphSize
// (default 16) picks the system glyph size nearest to it: 16, 32, 64 or 128
// points. LAAuthenticationView sizes itself to its control size, so these are
// the only sizes it draws at.

#import <AppKit/AppKit.h>
#import <LocalAuthentication/LocalAuthentication.h>
#import <LocalAuthenticationEmbeddedUI/LocalAuthenticationEmbeddedUI.h>

#define NAPI_VERSION 8
#include <node_api.h>
#include <math.h>
#include <string.h>

static const CGFloat kGlyph = 16;

struct GlyphSize {
  NSControlSize control;
  CGFloat points;
};

// The sizes LAAuthenticationView draws at, per control size.
static GlyphSize GlyphFor(double requested) {
  static const GlyphSize sizes[] = {
    {NSControlSizeMini, 16}, {NSControlSizeSmall, 32}, {NSControlSizeRegular, 64}, {NSControlSizeLarge, 128},
  };
  GlyphSize best = sizes[0];
  for (const GlyphSize &g : sizes) {
    if (fabs(g.points - requested) < fabs(best.points - requested)) best = g;
  }
  return best;
}

struct Outcome {
  bool ok;
  long code;
};

@interface APMTouchSession : NSObject
@property(nonatomic, strong) LAContext *context;
@property(nonatomic, strong) LAAuthenticationView *view;
@property(nonatomic, assign) napi_threadsafe_function done;
@property(nonatomic, assign) CGFloat glyph;
// Set by cancel(). A check the app has cancelled never reports success, even
// if a finger lands while the cancel is in flight.
@property(atomic, assign) BOOL cancelled;
@end

@implementation APMTouchSession
@end

static APMTouchSession *current = nil;

static napi_value Throw(napi_env env, const char *message) {
  napi_throw_error(env, NULL, message);
  return NULL;
}

static napi_value Bool(napi_env env, bool value) {
  napi_value out;
  napi_get_boolean(env, value, &out);
  return out;
}

static bool Number(napi_env env, napi_value obj, const char *key, double *out) {
  napi_value v;
  if (napi_get_named_property(env, obj, key, &v) != napi_ok) return false;
  return napi_get_value_double(env, v, out) == napi_ok;
}

static bool ReadRect(napi_env env, napi_value obj, NSRect *out) {
  double x, y, w, h;
  if (!Number(env, obj, "x", &x) || !Number(env, obj, "y", &y) || !Number(env, obj, "width", &w) || !Number(env, obj, "height", &h)) return false;
  *out = NSMakeRect(x, y, w, h);
  return true;
}

// An optional size argument: 16 when it is missing or not a positive number.
static double ReadGlyphSize(napi_env env, size_t argc, napi_value *argv, size_t index) {
  if (argc <= index) return kGlyph;
  double v = 0;
  if (napi_get_value_double(env, argv[index], &v) != napi_ok || !(v > 0) || v > 4096) return kGlyph;
  return v;
}

static bool ReadBool(napi_env env, napi_value v) {
  bool out = false;
  napi_get_value_bool(env, v, &out);
  return out;
}

static NSView *RootView(napi_env env, napi_value handle) {
  void *data = NULL;
  size_t len = 0;
  if (napi_get_buffer_info(env, handle, &data, &len) != napi_ok || len < sizeof(void *)) return nil;
  void *ptr = NULL;
  memcpy(&ptr, data, sizeof ptr);
  if (!ptr) return nil;
  id obj = (__bridge id)ptr;
  if (![obj isKindOfClass:[NSView class]]) return nil;
  NSView *view = obj;
  return view.window.contentView ?: view;
}

// Centres the glyph in rect, converting from top-left web coordinates.
static NSRect GlyphFrame(NSView *root, NSRect rect, CGFloat glyph) {
  CGFloat x = round(NSMinX(rect) + (NSWidth(rect) - glyph) / 2);
  CGFloat top = NSMinY(rect) + (NSHeight(rect) - glyph) / 2;
  CGFloat y = round(root.isFlipped ? top : NSHeight(root.bounds) - top - glyph);
  return NSMakeRect(x, y, glyph, glyph);
}

static void SetAppearance(NSView *view, bool dark) {
  view.appearance = [NSAppearance appearanceNamed:dark ? NSAppearanceNameDarkAqua : NSAppearanceNameAqua];
}

static void CallDone(napi_env env, napi_value cb, void *context, void *data) {
  Outcome *o = (Outcome *)data;
  if (env && cb) {
    napi_value argv[2], undefined;
    napi_get_boolean(env, o->ok, &argv[0]);
    napi_create_int64(env, o->code, &argv[1]);
    napi_get_undefined(env, &undefined);
    napi_call_function(env, undefined, cb, 2, argv, NULL);
  }
  delete o;
}

static void Cancel() {
  if (!current) return;
  APMTouchSession *s = current;
  current = nil;
  s.cancelled = YES;
  [s.view removeFromSuperview];
  [s.context invalidate];
}

static napi_value Available(napi_env env, napi_callback_info info) {
  LAContext *ctx = [LAContext new];
  return Bool(env, [ctx canEvaluatePolicy:LAPolicyDeviceOwnerAuthenticationWithBiometrics error:nil]);
}

static napi_value Start(napi_env env, napi_callback_info info) {
  size_t argc = 6;
  napi_value argv[6];
  napi_get_cb_info(env, info, &argc, argv, NULL, NULL);
  if (argc < 5) return Throw(env, "start(handle, rect, dark, reason, callback[, glyphSize])");
  NSView *root = RootView(env, argv[0]);
  if (!root) return Throw(env, "That is not a window handle.");
  NSRect rect;
  if (!ReadRect(env, argv[1], &rect)) return Throw(env, "rect needs x, y, width and height.");
  bool dark = ReadBool(env, argv[2]);
  char reason[512] = {0};
  size_t reasonLen = 0;
  if (napi_get_value_string_utf8(env, argv[3], reason, sizeof reason, &reasonLen) != napi_ok || reasonLen == 0) return Throw(env, "reason must be a string.");
  napi_valuetype cbType;
  napi_typeof(env, argv[4], &cbType);
  if (cbType != napi_function) return Throw(env, "callback must be a function.");
  GlyphSize glyph = GlyphFor(ReadGlyphSize(env, argc, argv, 5));

  Cancel();
  LAContext *ctx = [LAContext new];
  if (![ctx canEvaluatePolicy:LAPolicyDeviceOwnerAuthenticationWithBiometrics error:nil]) return Bool(env, false);

  napi_value name;
  napi_create_string_utf8(env, "apm-touchid", NAPI_AUTO_LENGTH, &name);
  napi_threadsafe_function done;
  if (napi_create_threadsafe_function(env, argv[4], NULL, name, 0, 1, NULL, NULL, NULL, CallDone, &done) != napi_ok) return Throw(env, "Could not create the Touch ID callback.");
  napi_unref_threadsafe_function(env, done);

  LAAuthenticationView *view = [[LAAuthenticationView alloc] initWithContext:ctx controlSize:glyph.control];
  view.frame = GlyphFrame(root, rect, glyph.points);
  SetAppearance(view, dark);
  [root addSubview:view positioned:NSWindowAbove relativeTo:nil];

  APMTouchSession *s = [APMTouchSession new];
  s.context = ctx;
  s.view = view;
  s.done = done;
  s.glyph = glyph.points;
  current = s;

  [ctx evaluatePolicy:LAPolicyDeviceOwnerAuthenticationWithBiometrics
      localizedReason:[NSString stringWithUTF8String:reason]
                reply:^(BOOL success, NSError *error) {
                  dispatch_async(dispatch_get_main_queue(), ^{
                    bool ok = success && !s.cancelled;
                    long code = ok ? 0 : s.cancelled ? (long)LAErrorAppCancel : (long)error.code;
                    [s.view removeFromSuperview];
                    if (current == s) current = nil;
                    napi_call_threadsafe_function(s.done, new Outcome{ok, code}, napi_tsfn_blocking);
                    napi_release_threadsafe_function(s.done, napi_tsfn_release);
                  });
                }];
  return Bool(env, true);
}

static napi_value Move(napi_env env, napi_callback_info info) {
  size_t argc = 3;
  napi_value argv[3];
  napi_get_cb_info(env, info, &argc, argv, NULL, NULL);
  if (!current || argc < 2) return NULL;
  NSRect rect;
  if (!ReadRect(env, argv[0], &rect)) return Throw(env, "rect needs x, y, width and height.");
  // glyphSize is accepted for symmetry with start(), but the view keeps the
  // control size it was made with, so the glyph is re-centred at that size.
  NSView *root = current.view.superview;
  if (root) current.view.frame = GlyphFrame(root, rect, current.glyph);
  SetAppearance(current.view, ReadBool(env, argv[1]));
  return NULL;
}

static napi_value CancelFn(napi_env env, napi_callback_info info) {
  Cancel();
  return NULL;
}

NAPI_MODULE_INIT() {
  napi_property_descriptor props[] = {
    {"available", NULL, Available, NULL, NULL, NULL, napi_default, NULL},
    {"start", NULL, Start, NULL, NULL, NULL, napi_default, NULL},
    {"move", NULL, Move, NULL, NULL, NULL, napi_default, NULL},
    {"cancel", NULL, CancelFn, NULL, NULL, NULL, napi_default, NULL},
  };
  napi_define_properties(env, exports, sizeof props / sizeof props[0], props);
  return exports;
}
