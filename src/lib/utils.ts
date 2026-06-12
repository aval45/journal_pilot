type ClassNameValue = string | false | null | undefined;

export function cn(...classes: ClassNameValue[]) {
  return classes.filter(Boolean).join(" ");
}
