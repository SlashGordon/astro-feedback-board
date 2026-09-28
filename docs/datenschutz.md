# Datenschutzhinweise: Vorlage

Diese Vorlage beschreibt, welche personenbezogenen Daten astro-feedback-board verarbeitet. Sie ergänzt eine bestehende Datenschutzerklärung, die den Verantwortlichen, die Kontaktdaten und die allgemeinen Betroffenenrechte schon nennt. Sie ist keine Rechtsberatung. Lassen Sie den fertigen Text im Zweifel von einer Fachperson prüfen.

Vor dem Einfügen:

- Platzhalter in eckigen Klammern ersetzen.
- Abschnitte streichen, die Sie nicht nutzen: Kommentare und Reaktionen, vertrauenswürdige Geräte, Kontextdaten, ntfy.
- Den Auftragsverarbeitungsvertrag mit Cloudflare (Data Processing Addendum) abschließen und eine Kopie ablegen.
- Den Eintrag von Cloudflare, Inc. auf [dataprivacyframework.gov](https://www.dataprivacyframework.gov) prüfen.
- Die D1-Datenbank mit `--jurisdiction eu` anlegen, damit die gespeicherten Daten in der EU liegen. Sonst den Satz dazu im Abschnitt „Empfänger" ändern.

---

## Feedback, Kommentare und Reaktionen

Auf [dieser Website] können Sie Feedback geben, Ideen und Fehler melden, Artikel kommentieren, über Beiträge abstimmen und auf Artikel reagieren. Dafür nutzen wir die Open-Source-Software astro-feedback-board, die wir selbst bei Cloudflare betreiben (Cloudflare Workers mit einer Cloudflare-D1-Datenbank). Das Board setzt keine Cookies, lädt keine Skripte oder Schriften von Drittanbietern und enthält kein Tracking.

### Beim Aufruf einer Seite

Seiten mit dem Feedback-Board oder mit Kommentaren laden ihre Inhalte beim Aufruf von [feedback.example.org]. Wenn Sie Ihr Gerät merken lassen, fragt außerdem jede Seite mit dem Feedback-Button dort nach neuen Antworten auf Ihre Beiträge. Dabei verarbeitet Cloudflare Ihre IP-Adresse und technische Angaben der Anfrage, etwa Browser und aufgerufene Adresse, um die Inhalte auszuliefern und Angriffe abzuwehren. Wir selbst speichern dabei keine IP-Adresse.

Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Unser berechtigtes Interesse ist die sichere Auslieferung der Website.

### Wenn Sie einen Beitrag senden

Wir speichern:

- den Text Ihres Beitrags,
- den Namen, falls Sie einen angeben,
- die Adresse der Seite, auf der Sie geschrieben haben, ohne Parameter,
- den Zeitpunkt,
- [technische Angaben zur Anwendung, zum Beispiel Tarif oder Version. Streichen, wenn Sie `context` nicht nutzen.]
- einen Hash Ihrer IP-Adresse (siehe „Schutz vor Missbrauch").

[Wir prüfen Beiträge, bevor sie erscheinen.] Freigegebene Beiträge sind öffentlich sichtbar, mit dem Namen, den Sie angegeben haben. Ohne Namen erscheint „Anonym" oder, wenn Sie Ihr Gerät merken lassen, ein zufällig erzeugter Name wie „Lunar Otter 42". Bitte schreiben Sie deshalb keine persönlichen Daten in Text oder Namen. Namen mit E-Mail-Adresse oder Telefonnummer nimmt das Formular nicht an.

[Wenn wir Beiträge eines gemerkten Geräts mehrmals freigegeben haben, können wir das Gerät als vertrauenswürdig markieren. Seine Beiträge erscheinen dann ohne vorherige Prüfung.]

Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Unser berechtigtes Interesse ist, Rückmeldungen zu [Produkt oder Website] zu sammeln, zu beantworten und öffentlich zu besprechen.

### Gerät merken

Unter dem Formular können Sie „Auf diesem Gerät merken" ankreuzen. Die Box ist nicht vorausgewählt. Nur wenn Sie sie ankreuzen, speichert Ihr Browser im lokalen Speicher (localStorage) eine zufällige Gerätekennung und Ihren Namen. Damit sehen Sie Ihre eigenen Beiträge, auch solange sie noch nicht freigegeben sind, und Antworten darauf. Außerdem können Sie Ihre Beiträge dann selbst löschen. Auf unserem Server speichern wir nur einen Hash dieser Kennung: an Ihren Beiträgen, Stimmen und Reaktionen sowie zusammen mit dem Zeitpunkt, an dem Sie Antworten zuletzt angesehen haben.

Wenn Sie die Karte schließen, die nach einigen Minuten nach Feedback fragt, speichert Ihr Browser außerdem, bis wann sie ausgeblendet bleibt.

Mit „Vergessen" unter dem Formular löschen Sie alle Beiträge dieses Geräts samt den Antworten darauf, Ihre Stimmen und Reaktionen, den erzeugten Namen und alle Einträge des Boards im lokalen Speicher.

Rechtsgrundlage für das Speichern in Ihrem Browser ist § 25 Abs. 2 Nr. 2 TDDDG, weil Sie diese Funktionen ausdrücklich anfordern. Für die Verarbeitung auf unserem Server gilt Art. 6 Abs. 1 lit. f DSGVO.

### Abstimmen und Reaktionen

Pro Beitrag, Internetanschluss und Tag kommt höchstens eine neue Stimme hinzu. Dafür speichern wir an jeder Stimme zwei Tage lang einen Hash aus Ihrer IP-Adresse und einem täglich neuen Zufallswert. Wenn Sie Ihr Gerät merken lassen, speichern wir Ihre Stimme mit dem Hash Ihrer Gerätekennung. Sie bleibt dann auch an den folgenden Tagen Ihre Stimme und Sie können sie zurücknehmen. Sonst speichern wir sie mit dem Hash Ihrer IP-Adresse. Reaktionen auf Artikel speichern wir mit dem Hash Ihrer Gerätekennung, wenn Sie Ihr Gerät merken lassen, sonst mit dem Hash Ihrer IP-Adresse.

### Schutz vor Missbrauch

Damit das Board nicht mit Spam gefüllt wird, begrenzen wir Beiträge, Stimmen und Reaktionen pro Internetanschluss. Dafür bildet unser Server aus Ihrer IP-Adresse und einem Zufallswert, der jeden Tag neu entsteht, einen Hash. Die IP-Adresse selbst speichern wir nicht. Den Zufallswert löschen wir nach zwei Tagen. Danach können auch wir nicht mehr feststellen, zu welcher IP-Adresse ein gespeicherter Hash gehört. Den Hash an Beiträgen, Stimmen und Reaktionen löschen wir ebenfalls nach zwei Tagen.

Vor dem Senden löst Ihr Browser außerdem eine kleine Rechenaufgabe (ALTCHA). Daran ist kein Drittanbieter beteiligt.

Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Unser berechtigtes Interesse ist der Schutz des Boards vor Spam und Missbrauch.

### Empfänger und Übermittlung in die USA

Die Server betreibt Cloudflare, Inc., 101 Townsend St., San Francisco, CA 94107, USA, als Auftragsverarbeiter nach Art. 28 DSGVO. Die gespeicherten Daten liegen in einer Datenbank in der EU. Für die Auslieferung kann Cloudflare auch Server außerhalb der EU nutzen. Cloudflare, Inc. ist nach dem EU-US Data Privacy Framework zertifiziert. Die Übermittlung stützt sich auf den Angemessenheitsbeschluss der EU-Kommission nach Art. 45 DSGVO.

[Über neue Beiträge benachrichtigt uns der Dienst ntfy ([ntfy.sh oder eigener Server]). Die Benachrichtigung enthält den Namen der Website, die Art des Beitrags und einen Link, aber nicht den Text.]

### Speicherdauer

| Daten | Speicherdauer |
| --- | --- |
| Freigegebene Beiträge mit Name, Seitenadresse [und Kontextdaten] | bis Sie oder wir sie löschen |
| Abgelehnte Beiträge und Spam | 30 Tage |
| Hash der Gerätekennung | bis die Beiträge gelöscht sind oder Sie das Gerät vergessen lassen |
| Hash der IP-Adresse an Beiträgen, Stimmen und Reaktionen | 2 Tage |
| Täglicher Zufallswert für den IP-Hash | 2 Tage, danach sind Stimmen und Reaktionen ohne gemerktes Gerät anonym |
| Einträge im lokalen Speicher Ihres Browsers | bis Sie „Vergessen" wählen oder die Websitedaten im Browser löschen |

### Ihre Rechte

Es gelten die Rechte aus [unserer Datenschutzerklärung], insbesondere auf Auskunft, Berichtigung und Löschung sowie das Recht, der Verarbeitung auf Grundlage berechtigter Interessen nach Art. 21 DSGVO zu widersprechen. Beiträge, die Sie ohne gemerktes Gerät geschrieben haben, können wir Ihnen nicht sicher zuordnen. Schreiben Sie uns dann an [E-Mail-Adresse] mit der Seite, dem ungefähren Zeitpunkt und dem Text. Wir löschen den Beitrag dann.
