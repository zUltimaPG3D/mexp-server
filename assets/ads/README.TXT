A snapshot of the FreeBSD Ports Collection.  It contains
makefiles, patches and configuration scripts necessary to make
the applications in the distfiles/ directory compile and run
on FreeBSD.  If your FreeBSD machine is connected to the
Internet, you need not download the application source code
from distfiles/ because the makefile will automatically fetch
it for you.  A better way to update your ports collection is to use
Git: see

  https://docs.FreeBSD.org/en/books/handbook/mirrors/#git

for more information.

If you prefer to use this tarball to update your ports collection,
you must remove the old copy (e.g. rm -rf /usr/ports/, although you
may like to preserve the /usr/ports/distfiles/ directory first)
before extracting the new one.  Otherwise, files removed from the
ports collection will still exist on your system, and you are likely
to encounter problems when compiling ports.

See https://www.FreeBSD.org/ports/ for more information about the Ports
Collection.
