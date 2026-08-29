{{- define "inari-console.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "inari-console.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "inari-console.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | quote }}
app.kubernetes.io/name: {{ include "inari-console.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/part-of: inari
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "inari-console.selectorLabels" -}}
app.kubernetes.io/name: {{ include "inari-console.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/*
Image/artifact reference: global.imageRegistry is prepended to the
repository; digest wins over tag.
Usage: {{ include "inari-console.image" (dict "root" . "image" .Values.nginx.image) }}
*/}}
{{- define "inari-console.image" -}}
{{- $repo := .image.repository -}}
{{- with .root.Values.global.imageRegistry -}}
{{- $repo = printf "%s/%s" (. | trimSuffix "/") $repo -}}
{{- end -}}
{{- if .image.digest -}}
{{- printf "%s@%s" $repo .image.digest -}}
{{- else -}}
{{- printf "%s:%s" $repo .image.tag -}}
{{- end -}}
{{- end -}}

{{/*
imagePullSecrets from global.imagePullSecrets (list of secret names).
Include at the target indentation.
*/}}
{{- define "inari-console.imagePullSecrets" -}}
{{- with .Values.global.imagePullSecrets }}
imagePullSecrets:
  {{- range . }}
  - name: {{ . | quote }}
  {{- end }}
{{- end }}
{{- end -}}
