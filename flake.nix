{
  edition = 201909;
  outputs = { nixpkgs, self }:
    with nixpkgs;
    with nixpkgs.lib; {

    defaultPackage = mapAttrs (name: arch: import ./default.nix { pkgs = arch; }) legacyPackages;
  };
}
